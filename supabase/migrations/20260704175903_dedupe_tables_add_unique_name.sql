-- Two "Table 1" rows existed (both with empty open_tickets, no real order
-- data) — a race from a rapid double-tap on "Add table" before the
-- addingTable/creating disabled-state guards took effect. Drops the newer
-- duplicate and its empty ticket, then adds a uniqueness constraint so the
-- database itself rejects this class of duplicate going forward, regardless
-- of any client-side race.
delete from open_tickets where table_id = '803400c1-0d22-4ede-844c-8382b8e7d5db';
delete from tables where id = '803400c1-0d22-4ede-844c-8382b8e7d5db';

alter table tables add constraint tables_name_unique unique (name);
