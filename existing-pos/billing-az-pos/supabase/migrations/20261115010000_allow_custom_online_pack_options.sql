DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname
    INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.online_product_pack_options'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%quantity%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.online_product_pack_options DROP CONSTRAINT %I',
      constraint_name
    );
  END IF;
END $$;

ALTER TABLE public.online_product_pack_options
  ADD CONSTRAINT online_product_pack_options_quantity_check CHECK (quantity > 0);
