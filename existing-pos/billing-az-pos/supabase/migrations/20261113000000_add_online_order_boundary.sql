CREATE TABLE public.online_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.online_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  online_order_id uuid NOT NULL REFERENCES public.online_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  sku text NOT NULL,
  quantity int NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL DEFAULT 0
);

CREATE INDEX online_orders_status_idx
  ON public.online_orders (status, created_at DESC);

CREATE INDEX online_order_items_order_idx
  ON public.online_order_items (online_order_id);

GRANT SELECT, UPDATE ON public.online_orders TO authenticated;
GRANT SELECT ON public.online_order_items TO authenticated;
GRANT ALL ON public.online_orders, public.online_order_items TO service_role;

ALTER TABLE public.online_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff can read online orders"
  ON public.online_orders
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "staff can update online orders"
  ON public.online_orders
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "staff can read online order items"
  ON public.online_order_items
  FOR SELECT TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.submit_online_order(_lines jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order_id uuid;
  _line jsonb;
  _product public.products%ROWTYPE;
  _product_id uuid;
  _quantity int;
  _line_count int := 0;
BEGIN
  IF jsonb_typeof(_lines) <> 'array' OR jsonb_array_length(_lines) = 0 THEN
    RAISE EXCEPTION 'An order must contain at least one product.';
  END IF;

  IF jsonb_array_length(_lines) > 100 THEN
    RAISE EXCEPTION 'An order cannot contain more than 100 lines.';
  END IF;

  INSERT INTO public.online_orders DEFAULT VALUES
  RETURNING id INTO _order_id;

  FOR _line IN SELECT value FROM jsonb_array_elements(_lines)
  LOOP
    _line_count := _line_count + 1;
    _product_id := (_line->>'productId')::uuid;
    _quantity := (_line->>'quantity')::int;

    IF _quantity IS NULL OR _quantity <= 0 THEN
      RAISE EXCEPTION 'Product quantities must be positive.';
    END IF;

    SELECT *
    INTO _product
    FROM public.products
    WHERE id = _product_id
      AND is_online = true
      AND is_active = true
      AND is_deleted = false
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'One or more products are no longer available.';
    END IF;

    IF _product.current_stock < _quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product %.', _product.name;
    END IF;

    INSERT INTO public.online_order_items (
      online_order_id, product_id, product_name, sku, quantity, unit_price
    )
    VALUES (
      _order_id, _product.id, _product.name, _product.sku, _quantity, _product.wholesale_price
    );
  END LOOP;

  IF _line_count = 0 THEN
    RAISE EXCEPTION 'An order must contain at least one product.';
  END IF;

  RETURN _order_id;
EXCEPTION
  WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'The order contains invalid product data.';
END;
$$;

REVOKE ALL ON FUNCTION public.submit_online_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_online_order(jsonb) TO anon, authenticated;
