CREATE TABLE public.ecommerce_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  is_enabled boolean NOT NULL DEFAULT true,
  banner_enabled boolean NOT NULL DEFAULT true,
  banner_title text NOT NULL DEFAULT 'Stock up with confidence.',
  banner_subtitle text NOT NULL DEFAULT 'Browse approved wholesale products and send your order to the POS.',
  banner_image_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.ecommerce_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.ecommerce_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.ecommerce_settings TO authenticated;

ALTER TABLE public.ecommerce_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public ecommerce settings read"
  ON public.ecommerce_settings
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "admin ecommerce settings insert"
  ON public.ecommerce_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "admin ecommerce settings update"
  ON public.ecommerce_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
