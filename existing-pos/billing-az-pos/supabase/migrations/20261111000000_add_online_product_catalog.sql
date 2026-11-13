ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS products_online_idx
  ON public.products (is_online)
  WHERE is_online = true AND is_active = true AND is_deleted = false;

GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.categories TO anon;

DROP POLICY IF EXISTS "public online product read" ON public.products;
CREATE POLICY "public online product read"
  ON public.products
  FOR SELECT
  TO anon
  USING (is_online = true AND is_active = true AND is_deleted = false);

DROP POLICY IF EXISTS "public active category read" ON public.categories;
CREATE POLICY "public active category read"
  ON public.categories
  FOR SELECT
  TO anon
  USING (is_active = true);
