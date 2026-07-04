-- Lets an admin deactivate a staff member from within the app without
-- needing dashboard/Admin-API access to disable their Supabase Auth login.
-- Enforced client-side (App.tsx blocks app usage when active=false) rather
-- than via RLS across every table — their login technically still works if
-- called directly against the API. Flagged as a known limitation.
alter table staff add column active boolean not null default true;
