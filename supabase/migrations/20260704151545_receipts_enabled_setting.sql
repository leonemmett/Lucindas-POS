-- Toggle for whether checkout offers a printable receipt. Defaults to true
-- (matches existing behavior) so this doesn't change anything until an admin
-- explicitly turns it off in the new Settings screen.
insert into settings (key, value)
values ('receipts_enabled', 'true'::jsonb)
on conflict (key) do nothing;
