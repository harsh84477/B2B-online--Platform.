-- Server-side MRP ceiling validation in create_bill.
-- Rejects any bill item where unit_price > product.mrp (when mrp > 0).

CREATE OR REPLACE FUNCTION public.create_bill(p_bill jsonb, p_items jsonb, p_payments jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _bill_id uuid; _inv text; _item jsonb; _pay jsonb;
  _need int; _take int; _b record; _uid uuid := auth.uid();
  _type public.bill_type := COALESCE((p_bill->>'bill_type')::public.bill_type, 'SALE');
  _cust uuid := NULLIF(p_bill->>'customer_id','')::uuid;
  _product_mrp numeric;
  _item_price numeric;
  _product_name text;
BEGIN
  -- ── MRP ceiling validation ──────────────────────────────────────────
  FOR _item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    _item_price := COALESCE((_item->>'unit_price')::numeric, 0);
    IF (_item->>'product_id') IS NOT NULL THEN
      SELECT p.mrp, p.name INTO _product_mrp, _product_name
        FROM public.products p
       WHERE p.id = (_item->>'product_id')::uuid;
      IF _product_mrp IS NOT NULL AND _product_mrp > 0 AND _item_price > _product_mrp THEN
        RAISE EXCEPTION 'Rate (%) exceeds MRP (%) for "%". Selling above MRP is not allowed.',
          _item_price, _product_mrp, _product_name;
      END IF;
    END IF;
  END LOOP;

  IF _type = 'HOLD' THEN
    _inv := 'HOLD-' || to_char(now(),'YYYYMMDDHH24MISSMS');
  ELSE
    _inv := public.next_invoice_number();
  END IF;

  INSERT INTO public.bills (invoice_number, customer_id, customer_name, customer_gstin, customer_address, customer_mobile,
    sub_total, total_discount, total_gst, round_off, grand_total, payment_mode, amount_paid, amount_due,
    payment_status, bill_type, notes, created_by)
  VALUES (_inv, _cust, p_bill->>'customer_name', p_bill->>'customer_gstin', p_bill->>'customer_address', p_bill->>'customer_mobile',
    COALESCE((p_bill->>'sub_total')::numeric,0), COALESCE((p_bill->>'total_discount')::numeric,0),
    COALESCE((p_bill->>'total_gst')::numeric,0), COALESCE((p_bill->>'round_off')::numeric,0),
    COALESCE((p_bill->>'grand_total')::numeric,0),
    COALESCE((p_bill->>'payment_mode')::public.payment_mode,'CASH'),
    COALESCE((p_bill->>'amount_paid')::numeric,0), COALESCE((p_bill->>'amount_due')::numeric,0),
    COALESCE((p_bill->>'payment_status')::public.payment_status,'PAID'), _type, p_bill->>'notes', _uid)
  RETURNING id INTO _bill_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.bill_items (bill_id, product_id, product_name, sku, hsn_code, quantity, pack_quantity, piece_quantity,
      pack_size, pack_name, unit_price, discount_percent, discount_amount, gst_percent, taxable_amount, cgst, sgst, total_amount)
    VALUES (_bill_id, NULLIF(_item->>'product_id','')::uuid, _item->>'product_name', _item->>'sku', _item->>'hsn_code',
      COALESCE((_item->>'quantity')::int,0), COALESCE((_item->>'pack_quantity')::int,0), COALESCE((_item->>'piece_quantity')::int,0),
      COALESCE((_item->>'pack_size')::int,1), _item->>'pack_name', COALESCE((_item->>'unit_price')::numeric,0),
      COALESCE((_item->>'discount_percent')::numeric,0), COALESCE((_item->>'discount_amount')::numeric,0),
      COALESCE((_item->>'gst_percent')::numeric,0), COALESCE((_item->>'taxable_amount')::numeric,0),
      COALESCE((_item->>'cgst')::numeric,0), COALESCE((_item->>'sgst')::numeric,0), COALESCE((_item->>'total_amount')::numeric,0));

    IF _type = 'SALE' AND (_item->>'product_id') IS NOT NULL THEN
      _need := COALESCE((_item->>'quantity')::int,0);
      FOR _b IN SELECT id, remaining_quantity FROM public.batches
                WHERE product_id = (_item->>'product_id')::uuid AND remaining_quantity > 0
                ORDER BY created_at ASC LOOP
        EXIT WHEN _need <= 0;
        _take := LEAST(_need, _b.remaining_quantity);
        UPDATE public.batches SET remaining_quantity = remaining_quantity - _take WHERE id = _b.id;
        INSERT INTO public.stock_movements (product_id, batch_id, type, quantity, reference_id, note, created_by)
        VALUES ((_item->>'product_id')::uuid, _b.id, 'SALE', -_take, _bill_id, _inv, _uid);
        _need := _need - _take;
      END LOOP;
      IF _need > 0 THEN
        INSERT INTO public.stock_movements (product_id, type, quantity, reference_id, note, created_by)
        VALUES ((_item->>'product_id')::uuid, 'SALE', -_need, _bill_id, _inv || ' (no batch)', _uid);
      END IF;
      UPDATE public.products SET current_stock = current_stock - COALESCE((_item->>'quantity')::int,0), updated_at = now()
      WHERE id = (_item->>'product_id')::uuid;
    END IF;
  END LOOP;

  IF _type <> 'HOLD' THEN
    FOR _pay IN SELECT * FROM jsonb_array_elements(COALESCE(p_payments,'[]'::jsonb)) LOOP
      INSERT INTO public.bill_payments (bill_id, customer_id, mode, amount, reference_number, created_by)
      VALUES (_bill_id, _cust, COALESCE((_pay->>'mode')::public.payment_mode,'CASH'),
              COALESCE((_pay->>'amount')::numeric,0), _pay->>'reference_number', _uid);
    END LOOP;

    IF _cust IS NOT NULL AND COALESCE((p_bill->>'amount_due')::numeric,0) <> 0 THEN
      UPDATE public.customers SET outstanding_balance = outstanding_balance + COALESCE((p_bill->>'amount_due')::numeric,0)
      WHERE id = _cust;
    END IF;

    INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, new_data)
    VALUES (_uid, 'CREATE', 'bill', _bill_id, jsonb_build_object('invoice_number', _inv, 'grand_total', p_bill->>'grand_total'));
  END IF;

  RETURN jsonb_build_object('id', _bill_id, 'invoice_number', _inv);
END; $$;

REVOKE ALL ON FUNCTION public.create_bill(jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_bill(jsonb, jsonb, jsonb) TO authenticated;
