-- Records which data-health warnings an admin has chosen to ignore, so
-- deliberate exceptions (a $0 "Toppings" placeholder, a free takeaway cup)
-- stop reappearing forever. Issues themselves are derived live from
-- menu_items/ingredients rather than stored — only the dismissals persist.
--
-- issue_key encodes check + subject, e.g. "menu_no_price:<uuid>", so it stays
-- stable across renames and a dismissal survives unrelated edits.
create table data_issue_dismissals (
  issue_key text primary key,
  dismissed_at timestamptz not null default now(),
  dismissed_by uuid references staff(id)
);

alter table data_issue_dismissals enable row level security;

-- Admin-gated in the UI (this only appears on the admin-only Alerts tab);
-- same wide-open authenticated policy as the other operational tables.
create policy "authenticated_full_access" on data_issue_dismissals
  for all to authenticated using (true) with check (true);
