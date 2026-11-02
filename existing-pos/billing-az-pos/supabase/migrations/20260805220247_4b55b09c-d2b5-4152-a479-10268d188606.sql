CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read settings" ON public.app_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert settings" ON public.app_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update settings" ON public.app_settings
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete settings" ON public.app_settings
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();