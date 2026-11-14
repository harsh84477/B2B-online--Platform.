CREATE TABLE public.online_product_pack_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity int NOT NULL CHECK (quantity IN (1, 2, 5)),
  label text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE (product_id, quantity)
);

INSERT INTO public.online_product_pack_options (product_id, quantity, label, sort_order)
SELECT p.id, options.quantity, options.label, options.sort_order
FROM public.products p
CROSS JOIN (VALUES
  (1, '1 pack', 1),
  (2, 'Pack of 2', 2),
  (5, 'Pack of 5', 3)
) AS options(quantity, label, sort_order)
WHERE p.is_deleted = false
ON CONFLICT (product_id, quantity) DO NOTHING;

CREATE INDEX online_product_pack_options_product_idx
  ON public.online_product_pack_options (product_id, sort_order);

GRANT SELECT ON public.online_product_pack_options TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.online_product_pack_options TO authenticated;

ALTER TABLE public.online_product_pack_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public online pack option read"
  ON public.online_product_pack_options
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND p.is_online = true
        AND p.is_active = true
        AND p.is_deleted = false
    )
  );

CREATE POLICY "admin online pack option insert"
  ON public.online_product_pack_options
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "admin online pack option update"
  ON public.online_product_pack_options
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "admin online pack option delete"
  ON public.online_product_pack_options
  FOR DELETE TO authenticated
  USING (public.is_admin());
