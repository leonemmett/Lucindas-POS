-- Replaces the single "expiring soon" window with a two-tier amber/red alert
-- system, applied to every ingredient with tracked containers (not just
-- gelato): amber = expiring within 14 days, red = within 5 days.
delete from settings where key = 'expiry_alert_window_days';

insert into settings (key, value) values ('expiry_alert_amber_days', '14'::jsonb)
on conflict (key) do update set value = excluded.value;

insert into settings (key, value) values ('expiry_alert_red_days', '5'::jsonb)
on conflict (key) do update set value = excluded.value;
