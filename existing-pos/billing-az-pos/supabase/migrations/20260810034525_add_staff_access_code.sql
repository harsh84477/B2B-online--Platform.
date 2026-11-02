ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS staff_access_code text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.validate_staff_access_code(_code text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.role = 'ADMIN'
      AND p.staff_access_code = COALESCE(NULLIF(TRIM(_code), ''), '')
  );
$$;

REVOKE ALL ON FUNCTION public.validate_staff_access_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_staff_access_code(text) TO anon, authenticated;
