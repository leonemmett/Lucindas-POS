// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createClient } from "@supabase/supabase-js";

// Receives a row edited in the "Products list" Google Sheet (called from an
// Apps Script onEdit trigger, see the setup snippet in the repo README/chat
// history — not committed here since it embeds the shared secret) and
// mirrors it into menu_items. Matched by name (case-insensitive), same as
// CSV import and push-menu-to-sheet. Only name/category/price/iva_rate are
// touched — recipe, container, ball_count, weight_grams, is_favourite are
// left alone since the sheet doesn't carry that data. Unlike the app UI,
// this writes with the service role key (bypassing RLS) because the caller
// is Apps Script, not a logged-in Supabase session — MENU_SHEET_WEBHOOK_SECRET
// is the real auth boundary here, not the publishable key.
//
// Deliberately does not handle row deletion — a row removed from the sheet
// does not delete the menu item. Deleting items stays an app-only action.
function parseIvaLabel(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "") return null;
  if (trimmed === "exempt") return 0;
  const hasPercent = trimmed.endsWith("%");
  const numPart = hasPercent ? trimmed.slice(0, -1) : trimmed;
  const num = Number(numPart);
  if (Number.isNaN(num)) return null;
  if (hasPercent) return num / 100;
  return num <= 1 ? num : num / 100;
}

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req) => {
    if (req.method !== "POST") {
      return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    }

    const webhookSecret = Deno.env.get("MENU_SHEET_WEBHOOK_SECRET");
    if (!webhookSecret || req.headers.get("x-webhook-secret") !== webhookSecret) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    let body: { name?: string; category?: string; price?: number | string; iva?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const name = body.name?.trim();
    if (!name) {
      return Response.json({ ok: false, error: "Missing name" }, { status: 400 });
    }

    const price = Number(body.price);
    if (Number.isNaN(price)) {
      return Response.json({ ok: false, error: "Missing or invalid price" }, { status: 400 });
    }

    const category = body.category?.trim() || "Other";
    const ivaRate = body.iva ? parseIvaLabel(body.iva) : null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existing, error: lookupError } = await supabase
      .from("menu_items")
      .select("id")
      .ilike("name", name)
      .maybeSingle();

    if (lookupError) {
      return Response.json({ ok: false, error: lookupError.message }, { status: 502 });
    }

    if (existing) {
      const patch: Record<string, unknown> = { category, price, updated_at: new Date().toISOString() };
      if (ivaRate !== null) patch.iva_rate = ivaRate;

      const { error: updateError } = await supabase.from("menu_items").update(patch).eq("id", existing.id);
      if (updateError) return Response.json({ ok: false, error: updateError.message }, { status: 502 });
      return Response.json({ ok: true, action: "updated" });
    }

    const { error: insertError } = await supabase.from("menu_items").insert({
      name,
      category,
      price,
      iva_rate: ivaRate ?? 0.16,
    });
    if (insertError) return Response.json({ ok: false, error: insertError.message }, { status: 502 });
    return Response.json({ ok: true, action: "created" });
  }),
};
