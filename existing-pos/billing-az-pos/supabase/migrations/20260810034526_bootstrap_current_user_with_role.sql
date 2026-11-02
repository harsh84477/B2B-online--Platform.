CREATE OR REPLACE FUNCTION public.bootstrap_current_user(
  _name text,
  _role public.app_role DEFAULT NULL,
  _email text DEFAULT NULL,
  _is_active boolean DEFAULT TRUE
)
RETURNS public.app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _has_admin boolean;
  _existing_role public.app_role;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.profiles (id, name, email, is_active)
  VALUES (_uid, COALESCE(NULLIF(_name, ''), 'Staff'), NULLIF(_email, ''), _is_active)
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(NULLIF(EXCLUDED.name, ''), public.profiles.name),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    is_active = COALESCE(EXCLUDED.is_active, public.profiles.is_active);

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'ADMIN') INTO _has_admin;
  SELECT role INTO _existing_role FROM public.user_roles WHERE user_id = _uid LIMIT 1;

  IF _existing_role IS NULL THEN
    IF _role IS NULL THEN
      _role := CASE WHEN _has_admin THEN 'SALES'::public.app_role ELSE 'ADMIN'::public.app_role END;
    END IF;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_uid, _role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN COALESCE(_existing_role, _role);
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_current_user(text, public.app_role, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_current_user(text, public.app_role, text, boolean) TO authenticated;
