// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

// Relays menu item changes to a Google Sheet, reusing the same Google Cloud
// service account and spreadsheet as push-cashup-to-sheet (a different tab).
// Upserts by name (column A) so re-saving an edited item overwrites its row
// instead of creating a duplicate — matches the name-based matching already
// used for menu item CSV import (see MenuManager.tsx).
type MenuRow = {
  name: string;
  category: string;
  price: number;
  ivaRate: number;
};

const SHEET_HEADERS = ["Name", "Category", "Price", "IVA"];

function ivaLabel(rate: number): string {
  return rate === 0 ? "Exempt" : `${Math.round(rate * 100)}%`;
}

function toRow(m: MenuRow): (string | number)[] {
  return [m.name, m.category, m.price, ivaLabel(m.ivaRate)];
}

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

function base64url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const encodedHeader = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const encodedClaimSet = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${encodedHeader}.${encodedClaimSet}`;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${base64url(new Uint8Array(signature))}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!tokenResponse.ok) {
    throw new Error(`Google token exchange failed: ${await tokenResponse.text()}`);
  }
  const tokenJson = await tokenResponse.json();
  return tokenJson.access_token;
}

async function getSheetIdByTitle(spreadsheetId: string, title: string, accessToken: string): Promise<number> {
  const res = await fetch(`${SHEETS_API}/${spreadsheetId}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to read spreadsheet metadata: ${await res.text()}`);
  const data = await res.json();
  // deno-lint-ignore no-explicit-any
  const sheet = data.sheets?.find((s: any) => s.properties.title === title);
  if (!sheet) throw new Error(`No sheet tab titled "${title}" found`);
  return sheet.properties.sheetId as number;
}

function columnLetter(count: number): string {
  let n = count;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

async function appendRow(
  spreadsheetId: string,
  sheetTitle: string,
  row: (string | number)[],
  accessToken: string,
) {
  const range = `${sheetTitle}!A:A`;
  const res = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [row] }),
    },
  );
  if (!res.ok) throw new Error(`Failed to append row: ${await res.text()}`);
}

async function deleteRowByName(
  spreadsheetId: string,
  sheetTitle: string,
  gid: number,
  name: string,
  accessToken: string,
) {
  const getRes = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(`${sheetTitle}!A:A`)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!getRes.ok) throw new Error(`Failed to read existing rows: ${await getRes.text()}`);
  const values: string[][] = (await getRes.json()).values ?? [];
  const rowIndex = values.findIndex((r) => r[0] === name);
  if (rowIndex < 0) return; // already gone — deleting is idempotent

  const res = await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        { deleteDimension: { range: { sheetId: gid, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 } } },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Failed to delete row: ${await res.text()}`);
}

async function upsertRow(
  spreadsheetId: string,
  sheetTitle: string,
  row: (string | number)[],
  accessToken: string,
) {
  const getRes = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(`${sheetTitle}!A:A`)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!getRes.ok) throw new Error(`Failed to read existing rows: ${await getRes.text()}`);
  const getData = await getRes.json();
  const values: string[][] = getData.values ?? [];

  if (values.length === 0) {
    await appendRow(spreadsheetId, sheetTitle, SHEET_HEADERS, accessToken);
  }

  let targetRowNumber = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === row[0]) {
      targetRowNumber = i + 1;
      break;
    }
  }

  if (targetRowNumber > 0) {
    const endCol = columnLetter(row.length);
    const updateRange = `${sheetTitle}!A${targetRowNumber}:${endCol}${targetRowNumber}`;
    const putRes = await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(updateRange)}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [row] }),
      },
    );
    if (!putRes.ok) throw new Error(`Failed to update row: ${await putRes.text()}`);
  } else {
    await appendRow(spreadsheetId, sheetTitle, row, accessToken);
  }
}

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req) => {
    if (req.method !== "POST" && req.method !== "DELETE") {
      return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    }

    const clientEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    const privateKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
    const spreadsheetId = Deno.env.get("GOOGLE_SHEET_ID");
    const sheetTitle = Deno.env.get("GOOGLE_MENU_SHEET_TAB") ?? "Products list";
    if (!clientEmail || !privateKey || !spreadsheetId) {
      return Response.json({ ok: false, error: "Sheet sync is not configured" }, { status: 500 });
    }

    let body: { name?: string } & Partial<MenuRow>;
    try {
      body = await req.json();
    } catch {
      return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }
    if (!body?.name) {
      return Response.json({ ok: false, error: "Missing name" }, { status: 400 });
    }

    try {
      const accessToken = await getAccessToken(clientEmail, privateKey);
      const gid = await getSheetIdByTitle(spreadsheetId, sheetTitle, accessToken);
      if (req.method === "DELETE") {
        await deleteRowByName(spreadsheetId, sheetTitle, gid, body.name, accessToken);
      } else {
        await upsertRow(spreadsheetId, sheetTitle, toRow(body as MenuRow), accessToken);
      }
      return Response.json({ ok: true });
    } catch (err) {
      return Response.json({ ok: false, error: String(err) }, { status: 502 });
    }
  }),
};
