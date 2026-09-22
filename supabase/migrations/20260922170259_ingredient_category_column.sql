-- Explicit ingredient category, chosen at creation time going forward
-- (see ReceiveDeliveryScreen's "New item" flow). Existing rows stay null —
-- categorizeIngredient() in lib/inventory.ts falls back to its existing
-- name/flag-based derivation for anything without one, so no backfill is
-- required.
alter table ingredients add column category text;
