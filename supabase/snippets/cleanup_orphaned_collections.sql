-- Remove collection name references from books where no matching row exists in the collections table.
-- Safe to run multiple times (idempotent). Run this once against prod to clear existing ghost references.
UPDATE public.books b
SET collections = ARRAY(
  SELECT col
  FROM unnest(b.collections) AS col
  WHERE col IN (SELECT name FROM public.collections WHERE user_id = b.user_id)
  ORDER BY col
)
WHERE EXISTS (
  SELECT 1 FROM unnest(b.collections) AS col
  WHERE col NOT IN (SELECT name FROM public.collections WHERE user_id = b.user_id)
);
