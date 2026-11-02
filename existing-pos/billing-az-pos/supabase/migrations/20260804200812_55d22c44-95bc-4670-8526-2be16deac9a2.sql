CREATE TABLE public.credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number text NOT NULL UNIQUE,
  original_bill_id uuid REFERENCES public.bills(id),
  customer_id uuid REFERENCES public.customers(id),
  customer_name text,
  note_date timestamptz NOT NULL DEFAULT now(),
  sub_total numeric NOT NULL DEFAULT 0,
  gst_amount numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  adjustment_type text NOT NULL DEFAULT 'CREDIT',
  reason text,
  restock boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_notes TO authenticated;
GRANT ALL ON public.credit_notes TO service_role;
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cn_select" ON public.credit_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "cn_insert" ON public.credit_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cn_update" ON public.credit_notes FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "cn_delete" ON public.credit_notes FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE public.credit_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id uuid NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  product_name text NOT NULL,
  sku text,
  quantity integer NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  gst_percent numeric NOT NULL DEFAULT 0,
  taxable_amount numeric NOT NULL DEFAULT 0,
  gst_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_note_items TO authenticated;
GRANT ALL ON public.credit_note_items TO service_role;
ALTER TABLE public.credit_note_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cni_select" ON public.credit_note_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "cni_insert" ON public.credit_note_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cni_update" ON public.credit_note_items FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "cni_delete" ON public.credit_note_items FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE public.customer_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  amount numeric NOT NULL DEFAULT 0,
  mode public.payment_mode NOT NULL DEFAULT 'CASH',
  reference_number text,
  note text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_payments TO authenticated;
GRANT ALL ON public.customer_payments TO service_role;
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cp_select" ON public.customer_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "cp_insert" ON public.customer_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cp_update" ON public.customer_payments FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "cp_delete" ON public.customer_payments FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE public.supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id),
  amount numeric NOT NULL DEFAULT 0,
  mode public.payment_mode NOT NULL DEFAULT 'CASH',
  reference_number text,
  note text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_payments TO authenticated;
GRANT ALL ON public.supplier_payments TO service_role;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sp_select" ON public.supplier_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "sp_insert" ON public.supplier_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sp_update" ON public.supplier_payments FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "sp_delete" ON public.supplier_payments FOR DELETE TO authenticated USING (public.is_admin());

ALTER TABLE public.day_closes
  ADD COLUMN IF NOT EXISTS opening_cash numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cheque_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bank_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_expenses numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS counted_cash numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE OR REPLACE FUNCTION public.next_credit_note_number()
RETURNS text LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE _n int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('billingaz_credit_note'));
  SELECT COALESCE(MAX(NULLIF(regexp_replace(credit_note_number, '^.*?(\d+)$', '\1'), '')::int), 0) + 1
    INTO _n FROM public.credit_notes;
  RETURN 'CN-' || lpad(_n::text, 5, '0');
END; $$;

CREATE OR REPLACE FUNCTION public.create_credit_note(p_note jsonb, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE _id uuid; _num text; _item jsonb; _uid uuid := auth.uid();
  _cust uuid := NULLIF(p_note->>'customer_id','')::uuid;
  _restock boolean := COALESCE((p_note->>'restock')::boolean, true);
  _net numeric := COALESCE((p_note->>'net_amount')::numeric,0);
BEGIN
  _num := public.next_credit_note_number();
  INSERT INTO public.credit_notes (credit_note_number, original_bill_id, customer_id, customer_name,
    sub_total, gst_amount, net_amount, adjustment_type, reason, restock, created_by)
  VALUES (_num, NULLIF(p_note->>'original_bill_id','')::uuid, _cust, p_note->>'customer_name',
    COALESCE((p_note->>'sub_total')::numeric,0), COALESCE((p_note->>'gst_amount')::numeric,0),
    _net, COALESCE(p_note->>'adjustment_type','CREDIT'), p_note->>'reason', _restock, _uid)
  RETURNING id INTO _id;

  FOR _item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.credit_note_items (credit_note_id, product_id, product_name, sku, quantity,
      unit_price, gst_percent, taxable_amount, gst_amount, total_amount)
    VALUES (_id, NULLIF(_item->>'product_id','')::uuid, _item->>'product_name', _item->>'sku',
      COALESCE((_item->>'quantity')::int,0), COALESCE((_item->>'unit_price')::numeric,0),
      COALESCE((_item->>'gst_percent')::numeric,0), COALESCE((_item->>'taxable_amount')::numeric,0),
      COALESCE((_item->>'gst_amount')::numeric,0), COALESCE((_item->>'total_amount')::numeric,0));

    IF _restock AND (_item->>'product_id') IS NOT NULL AND COALESCE((_item->>'quantity')::int,0) > 0 THEN
      UPDATE public.products SET current_stock = current_stock + (_item->>'quantity')::int, updated_at = now()
        WHERE id = (_item->>'product_id')::uuid;
      INSERT INTO public.stock_movements (product_id, type, quantity, reference_id, note, created_by)
      VALUES ((_item->>'product_id')::uuid, 'SALE_RETURN', (_item->>'quantity')::int, _id, _num, _uid);
    END IF;
  END LOOP;

  IF _cust IS NOT NULL AND COALESCE(p_note->>'adjustment_type','CREDIT') = 'CREDIT' THEN
    UPDATE public.customers SET outstanding_balance = outstanding_balance - _net WHERE id = _cust;
  END IF;

  INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, new_data)
  VALUES (_uid, 'CREATE', 'credit_note', _id, jsonb_build_object('number', _num, 'net_amount', _net));

  RETURN jsonb_build_object('id', _id, 'credit_note_number', _num);
END; $$;

REVOKE ALL ON FUNCTION public.next_credit_note_number() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_credit_note(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_credit_note(jsonb, jsonb) TO authenticated;