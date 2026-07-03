-- Records the per-denomination notes/coins removed from (excess above float)
-- and added to (topped up below float) the till during cashing up, so the
-- historical record doesn't depend on settings.float_composition possibly
-- changing later.
alter table cashups add column till_adjustments jsonb;

-- Seed the till float with the exact denomination breakdown in use.
insert into settings (key, value)
values ('float_composition', '{"500":1,"200":5,"100":5,"50":5,"20":8,"10":10,"5":10,"2":10,"1":10}'::jsonb)
on conflict (key) do update set value = excluded.value;
