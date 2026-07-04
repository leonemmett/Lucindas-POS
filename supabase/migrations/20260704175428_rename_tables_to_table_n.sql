-- Existing tables were named as bare numerals ("1", "2", ...) from the
-- original quick-add flow; the app now names them "Table 1", "Table 2", etc.
-- Only touches names that are purely numeric, leaving any custom names alone.
update tables
set name = 'Table ' || name
where name ~ '^[0-9]+$';
