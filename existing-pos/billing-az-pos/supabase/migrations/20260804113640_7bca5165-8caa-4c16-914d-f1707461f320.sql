
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('ADMIN','SALES','ACCOUNTANT','STOCK_MANAGER');
CREATE TYPE public.unit_type AS ENUM ('PIECE','KG','LITRE','GRAM','ML','BOX','BUNDLE');
CREATE TYPE public.payment_mode AS ENUM ('CASH','UPI','CREDIT','CHEQUE','BANK_TRANSFER','SPLIT');
CREATE TYPE public.payment_status AS ENUM ('PAID','PARTIAL','UNPAID');
CREATE TYPE public.bill_type AS ENUM ('SALE','SALE_RETURN','DRAFT','HOLD');
CREATE TYPE public.movement_type AS ENUM ('PURCHASE','SALE','SALE_RETURN','PURCHASE_RETURN','ADJUSTMENT','OPENING_STOCK','DAMAGE');
CREATE TYPE public.po_status AS ENUM ('PENDING','COMPLETED','CANCELLED');

-- PROFILES + ROLES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'ADMIN');
$$;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "own profile write" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "roles read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- Bootstrap: first signed-in user claims ADMIN
CREATE OR REPLACE FUNCTION public.bootstrap_current_user(_name text)
RETURNS public.app_role LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _role public.app_role; _has_admin boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.profiles (id, name) VALUES (_uid, COALESCE(NULLIF(_name,''),'Staff'))
    ON CONFLICT (id) DO UPDATE SET name = COALESCE(NULLIF(EXCLUDED.name,''), public.profiles.name);
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role='ADMIN') INTO _has_admin;
  SELECT role INTO _role FROM public.user_roles WHERE user_id=_uid LIMIT 1;
  IF _role IS NULL THEN
    _role := CASE WHEN _has_admin THEN 'SALES'::public.app_role ELSE 'ADMIN'::public.app_role END;
    INSERT INTO public.user_roles (user_id, role) VALUES (_uid, _role) ON CONFLICT DO NOTHING;
  END IF;
  RETURN _role;
END; $$;

-- SHOP PROFILE
CREATE TABLE public.shop_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_name text NOT NULL DEFAULT 'BillingAZ Wholesale',
  address text DEFAULT '', phone text DEFAULT '', email text DEFAULT '',
  gstin text DEFAULT '', state_code text DEFAULT '27',
  bank_name text DEFAULT '', bank_account text DEFAULT '', ifsc text DEFAULT '',
  logo_url text, invoice_prefix text NOT NULL DEFAULT 'INV',
  invoice_start_number int NOT NULL DEFAULT 1,
  default_gst_slab numeric NOT NULL DEFAULT 5,
  terms text DEFAULT 'Goods once sold will not be taken back.',
  whatsapp_template text DEFAULT 'Hello {{customerName}}, thank you for your purchase at {{shopName}}. Invoice {{invoiceNumber}} for Rs {{amount}}.',
  auto_print boolean NOT NULL DEFAULT false,
  theme text NOT NULL DEFAULT 'LIGHT',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.shop_profile TO authenticated;
GRANT ALL ON public.shop_profile TO service_role;
ALTER TABLE public.shop_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop read" ON public.shop_profile FOR SELECT TO authenticated USING (true);
CREATE POLICY "shop update" ON public.shop_profile FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "shop insert" ON public.shop_profile FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- CATEGORIES
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat read" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "cat write" ON public.categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cat update" ON public.categories FOR UPDATE TO authenticated USING (true);
CREATE POLICY "cat delete" ON public.categories FOR DELETE TO authenticated USING (public.is_admin());

-- PRODUCTS
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text NOT NULL UNIQUE,
  barcode text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  brand text, image_url text, description text,
  purchase_price numeric NOT NULL DEFAULT 0,
  selling_price numeric NOT NULL DEFAULT 0,
  wholesale_price numeric NOT NULL DEFAULT 0,
  mrp numeric NOT NULL DEFAULT 0,
  gst_percent numeric NOT NULL DEFAULT 0,
  hsn_code text,
  base_unit public.unit_type NOT NULL DEFAULT 'PIECE',
  pack_name text NOT NULL DEFAULT 'Case',
  pack_size int NOT NULL DEFAULT 1,
  allow_piece_sale boolean NOT NULL DEFAULT true,
  allow_pack_sale boolean NOT NULL DEFAULT true,
  current_stock int NOT NULL DEFAULT 0,
  min_stock_alert int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_name_idx ON public.products (lower(name));
CREATE INDEX products_cat_idx ON public.products (category_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prod read" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "prod insert" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "prod update" ON public.products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "prod delete" ON public.products FOR DELETE TO authenticated USING (public.is_admin());

-- SUPPLIERS
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, mobile text, email text, gstin text, address text,
  outstanding_balance numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sup read" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "sup insert" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sup update" ON public.suppliers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "sup delete" ON public.suppliers FOR DELETE TO authenticated USING (public.is_admin());

-- BATCHES
CREATE TABLE public.batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_number text,
  expiry_date date, manufacturing_date date,
  purchase_price numeric NOT NULL DEFAULT 0,
  quantity_base_units int NOT NULL DEFAULT 0,
  remaining_quantity int NOT NULL DEFAULT 0,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX batches_fifo_idx ON public.batches (product_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batches TO authenticated;
GRANT ALL ON public.batches TO service_role;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batch read" ON public.batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "batch insert" ON public.batches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "batch update" ON public.batches FOR UPDATE TO authenticated USING (true);
CREATE POLICY "batch delete" ON public.batches FOR DELETE TO authenticated USING (public.is_admin());

-- CUSTOMERS
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mobile text UNIQUE,
  email text, gstin text, address text, city text, pincode text, state text,
  credit_limit numeric NOT NULL DEFAULT 0,
  outstanding_balance numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cust read" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "cust insert" ON public.customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cust update" ON public.customers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "cust delete" ON public.customers FOR DELETE TO authenticated USING (public.is_admin());

-- BILLS
CREATE TABLE public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  invoice_date timestamptz NOT NULL DEFAULT now(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text, customer_gstin text, customer_address text, customer_mobile text,
  sub_total numeric NOT NULL DEFAULT 0,
  total_discount numeric NOT NULL DEFAULT 0,
  total_gst numeric NOT NULL DEFAULT 0,
  round_off numeric NOT NULL DEFAULT 0,
  grand_total numeric NOT NULL DEFAULT 0,
  payment_mode public.payment_mode NOT NULL DEFAULT 'CASH',
  amount_paid numeric NOT NULL DEFAULT 0,
  amount_due numeric NOT NULL DEFAULT 0,
  payment_status public.payment_status NOT NULL DEFAULT 'PAID',
  bill_type public.bill_type NOT NULL DEFAULT 'SALE',
  original_bill_id uuid REFERENCES public.bills(id) ON DELETE SET NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz, deleted_reason text
);
CREATE INDEX bills_date_idx ON public.bills (invoice_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bills TO authenticated;
GRANT ALL ON public.bills TO service_role;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bill read" ON public.bills FOR SELECT TO authenticated USING (true);
CREATE POLICY "bill insert" ON public.bills FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "bill update" ON public.bills FOR UPDATE TO authenticated USING (true);
CREATE POLICY "bill delete" ON public.bills FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE public.bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL, sku text, hsn_code text,
  quantity int NOT NULL DEFAULT 0,
  pack_quantity int NOT NULL DEFAULT 0,
  piece_quantity int NOT NULL DEFAULT 0,
  pack_size int NOT NULL DEFAULT 1,
  pack_name text DEFAULT 'Case',
  unit_price numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  gst_percent numeric NOT NULL DEFAULT 0,
  taxable_amount numeric NOT NULL DEFAULT 0,
  cgst numeric NOT NULL DEFAULT 0,
  sgst numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL
);
CREATE INDEX bill_items_bill_idx ON public.bill_items (bill_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_items TO authenticated;
GRANT ALL ON public.bill_items TO service_role;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bi read" ON public.bill_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "bi insert" ON public.bill_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "bi update" ON public.bill_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "bi delete" ON public.bill_items FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE public.bill_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid REFERENCES public.bills(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  mode public.payment_mode NOT NULL DEFAULT 'CASH',
  amount numeric NOT NULL DEFAULT 0,
  reference_number text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_payments TO authenticated;
GRANT ALL ON public.bill_payments TO service_role;
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bp read" ON public.bill_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "bp insert" ON public.bill_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "bp update" ON public.bill_payments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "bp delete" ON public.bill_payments FOR DELETE TO authenticated USING (public.is_admin());

-- STOCK MOVEMENTS
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL,
  type public.movement_type NOT NULL,
  quantity int NOT NULL,
  reference_id uuid, note text, created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sm read" ON public.stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "sm insert" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sm delete" ON public.stock_movements FOR DELETE TO authenticated USING (public.is_admin());

-- PURCHASES
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invoice_number text, invoice_date date NOT NULL DEFAULT current_date,
  sub_total numeric NOT NULL DEFAULT 0,
  total_gst numeric NOT NULL DEFAULT 0,
  grand_total numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  status public.po_status NOT NULL DEFAULT 'COMPLETED',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po read" ON public.purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "po insert" ON public.purchase_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "po update" ON public.purchase_orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "po delete" ON public.purchase_orders FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL,
  quantity_base_units int NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  gst_percent numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_items TO authenticated;
GRANT ALL ON public.purchase_items TO service_role;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pi read" ON public.purchase_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "pi insert" ON public.purchase_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pi delete" ON public.purchase_items FOR DELETE TO authenticated USING (public.is_admin());

-- EXPENSES
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ec read" ON public.expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "ec insert" ON public.expense_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ec delete" ON public.expense_categories FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  description text,
  date date NOT NULL DEFAULT current_date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exp read" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "exp insert" ON public.expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "exp update" ON public.expenses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "exp delete" ON public.expenses FOR DELETE TO authenticated USING (public.is_admin());

-- AUDIT LOG
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid, action text NOT NULL, entity_type text, entity_id uuid,
  old_data jsonb, new_data jsonb, ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit read" ON public.audit_log FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "audit insert" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- DAY CLOSE
CREATE TABLE public.day_closes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  close_date date NOT NULL UNIQUE,
  total_sales numeric NOT NULL DEFAULT 0,
  cash_total numeric NOT NULL DEFAULT 0,
  upi_total numeric NOT NULL DEFAULT 0,
  credit_total numeric NOT NULL DEFAULT 0,
  bill_count int NOT NULL DEFAULT 0,
  item_count int NOT NULL DEFAULT 0,
  closed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.day_closes TO authenticated;
GRANT ALL ON public.day_closes TO service_role;
ALTER TABLE public.day_closes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dc read" ON public.day_closes FOR SELECT TO authenticated USING (true);
CREATE POLICY "dc insert" ON public.day_closes FOR INSERT TO authenticated WITH CHECK (true);

-- ============ SEED ============
INSERT INTO public.shop_profile (shop_name, address, phone, email, gstin, state_code, bank_name, bank_account, ifsc)
VALUES ('Shree Balaji Wholesale Traders', 'Shop 14, APMC Market Yard, Navi Mumbai, Maharashtra 400705', '+91 98200 11223', 'orders@shreebalaji.in', '27AABCS1429B1ZX', '27', 'HDFC Bank', '50200034567891', 'HDFC0000123');

INSERT INTO public.categories (name, sort_order) VALUES
('Spices',1),('Rice',2),('Pulses',3),('Oil',4),('Biscuit',5),('Soap',6),('Shampoo',7),('Dairy',8),('Cold Drinks',9),('Snacks',10);

INSERT INTO public.expense_categories (name) VALUES ('Transport'),('Rent'),('Electricity'),('Salary'),('Packing Material'),('Miscellaneous');

INSERT INTO public.suppliers (name, mobile, gstin, address) VALUES
('Gupta Distributors','+91 98765 43210','27AAECG1234H1Z5','Bhiwandi, Thane'),
('Mahalaxmi Agencies','+91 90045 66778','27AACCM9876K1ZQ','Vashi, Navi Mumbai'),
('Sai Krupa Traders','+91 98330 22114','27AAGCS4433L1ZP','Kalyan, Maharashtra');

INSERT INTO public.customers (name, mobile, address, city, state, pincode, credit_limit) VALUES
('Sharma Kirana Store','9820011111','Sector 12, Vashi','Navi Mumbai','Maharashtra','400703',50000),
('Patel General Stores','9820022222','Main Road, Panvel','Panvel','Maharashtra','410206',75000),
('Krishna Super Market','9820033333','Station Road, Kalyan','Kalyan','Maharashtra','421301',100000),
('Deshmukh Provision','9820044444','Gandhi Chowk, Dombivli','Dombivli','Maharashtra','421201',30000),
('New Bombay Traders','9820055555','APMC Market, Turbhe','Navi Mumbai','Maharashtra','400705',150000),
('Iyer Stores','9820066666','Hill Road, Bandra','Mumbai','Maharashtra','400050',25000),
('Anand Kirana','9820077777','Nehru Nagar, Kurla','Mumbai','Maharashtra','400070',40000),
('Sai Provision Mart','9820088888','Market Yard, Thane','Thane','Maharashtra','400601',60000),
('Reliable Grocers','9820099999','Sector 7, Airoli','Navi Mumbai','Maharashtra','400708',80000),
('Om Sai Wholesale','9820010101','Old Mumbai Pune Road','Kharghar','Maharashtra','410210',120000);

INSERT INTO public.products (name, sku, category_id, brand, purchase_price, selling_price, wholesale_price, mrp, gst_percent, hsn_code, base_unit, pack_name, pack_size, current_stock, min_stock_alert)
SELECT p.name, p.sku, c.id, p.brand, p.pp, p.sp, p.wp, p.mrp, p.gst, p.hsn, p.unit::public.unit_type, p.pack, p.psize, p.stock, p.minstock
FROM (VALUES
('Everest Turmeric Powder 200g','SPI001','Spices','Everest',52,68,58,70,5,'0910','PIECE','Box',24,240,48),
('MDH Garam Masala 100g','SPI002','Spices','MDH',68,85,74,88,5,'0910','PIECE','Box',20,200,40),
('Catch Red Chilli Powder 500g','SPI003','Spices','Catch',140,175,152,180,5,'0904','PIECE','Box',12,120,24),
('Everest Coriander Powder 500g','SPI004','Spices','Everest',118,148,128,155,5,'0909','PIECE','Box',12,144,24),
('Badshah Sambhar Masala 100g','SPI005','Spices','Badshah',48,62,54,65,5,'0910','PIECE','Box',24,192,48),
('India Gate Basmati Rice 5kg','RIC001','Rice','India Gate',520,640,565,660,5,'1006','PIECE','Bag',5,75,15),
('Daawat Rozana Rice 10kg','RIC002','Rice','Daawat',640,780,695,800,5,'1006','PIECE','Bag',4,48,8),
('Kohinoor Basmati 1kg','RIC003','Rice','Kohinoor',118,145,128,150,5,'1006','PIECE','Case',20,200,40),
('Sona Masoori Rice 25kg','RIC004','Rice','Local',1150,1380,1240,1400,5,'1006','PIECE','Bag',2,24,4),
('Idli Rice 10kg','RIC005','Rice','Local',430,530,470,545,5,'1006','PIECE','Bag',4,40,8),
('Tata Sampann Toor Dal 1kg','PUL001','Pulses','Tata',132,162,142,168,0,'0713','PIECE','Case',12,240,48),
('Tata Sampann Moong Dal 1kg','PUL002','Pulses','Tata',124,152,134,158,0,'0713','PIECE','Case',12,180,36),
('Chana Dal 1kg','PUL003','Pulses','Local',82,102,90,105,0,'0713','PIECE','Case',12,192,36),
('Rajma Chitra 1kg','PUL004','Pulses','Local',128,158,138,162,0,'0713','PIECE','Case',12,120,24),
('Kabuli Chana 1kg','PUL005','Pulses','Local',96,120,105,124,0,'0713','PIECE','Case',12,144,24),
('Fortune Sunflower Oil 1L','OIL001','Oil','Fortune',138,168,148,172,5,'1512','PIECE','Case',12,240,48),
('Saffola Gold Oil 5L','OIL002','Oil','Saffola',840,1010,910,1030,5,'1512','PIECE','Case',4,48,8),
('Dhara Mustard Oil 1L','OIL003','Oil','Dhara',148,178,160,182,5,'1514','PIECE','Case',12,180,36),
('Parachute Coconut Oil 500ml','OIL004','Oil','Parachute',152,185,165,190,5,'1513','PIECE','Case',12,144,24),
('Gemini Refined Oil 15L Tin','OIL005','Oil','Gemini',2050,2380,2210,2400,5,'1512','PIECE','Case',1,20,4),
('Parle-G Biscuit 800g','BIS001','Biscuit','Parle',88,105,94,110,18,'1905','PIECE','Case',12,240,48),
('Britannia Good Day 600g','BIS002','Biscuit','Britannia',108,130,118,135,18,'1905','PIECE','Case',12,180,36),
('Sunfeast Marie Light 250g','BIS003','Biscuit','Sunfeast',32,42,36,45,18,'1905','PIECE','Case',24,336,48),
('Oreo Original 120g','BIS004','Biscuit','Cadbury',28,35,31,35,18,'1905','PIECE','Case',24,288,48),
('Britannia Bourbon 400g','BIS005','Biscuit','Britannia',72,90,80,95,18,'1905','PIECE','Case',12,168,24),
('Lifebuoy Soap 125g','SOA001','Soap','Lifebuoy',26,34,29,35,18,'3401','PIECE','Case',48,480,96),
('Lux Rose Soap 100g','SOA002','Soap','Lux',30,39,34,40,18,'3401','PIECE','Case',48,432,96),
('Santoor Sandal Soap 125g','SOA003','Soap','Santoor',32,42,36,44,18,'3401','PIECE','Case',48,384,96),
('Dettol Original Soap 125g','SOA004','Soap','Dettol',38,48,42,50,18,'3401','PIECE','Case',48,336,48),
('Medimix Ayurvedic Soap 125g','SOA005','Soap','Medimix',34,44,38,45,18,'3401','PIECE','Case',48,288,48),
('Clinic Plus Shampoo 340ml','SHA001','Shampoo','Clinic Plus',178,215,192,220,18,'3305','PIECE','Case',12,144,24),
('Head & Shoulders 180ml','SHA002','Shampoo','H&S',168,205,182,210,18,'3305','PIECE','Case',12,120,24),
('Dove Shampoo 340ml','SHA003','Shampoo','Dove',290,350,315,360,18,'3305','PIECE','Case',12,96,12),
('Sunsilk Black Shine 180ml','SHA004','Shampoo','Sunsilk',105,130,115,135,18,'3305','PIECE','Case',12,144,24),
('Chik Shampoo Sachet Pack','SHA005','Shampoo','Chik',68,88,76,90,18,'3305','PIECE','Case',20,200,40),
('Amul Butter 500g','DAI001','Dairy','Amul',255,290,268,295,12,'0405','PIECE','Box',20,100,20),
('Amul Taaza Milk 1L','DAI002','Dairy','Amul',62,70,66,72,5,'0401','PIECE','Crate',12,120,24),
('Nestle Everyday Milk Powder 400g','DAI003','Dairy','Nestle',215,255,232,260,5,'0402','PIECE','Case',12,96,24),
('Amul Cheese Slices 200g','DAI004','Dairy','Amul',118,140,128,145,12,'0406','PIECE','Box',12,60,12),
('Gowardhan Ghee 1L','DAI005','Dairy','Gowardhan',540,640,585,650,12,'0405','PIECE','Case',6,48,12),
('Coca Cola 750ml','CLD001','Cold Drinks','Coca Cola',30,40,34,40,28,'2202','PIECE','Crate',24,240,48),
('Thums Up 1.25L','CLD002','Cold Drinks','Coca Cola',52,65,57,65,28,'2202','PIECE','Crate',12,144,24),
('Sprite 750ml','CLD003','Cold Drinks','Coca Cola',30,40,34,40,28,'2202','PIECE','Crate',24,192,48),
('Maaza Mango 1.2L','CLD004','Cold Drinks','Coca Cola',56,70,62,70,12,'2202','PIECE','Crate',12,120,24),
('Bisleri Water 1L','CLD005','Cold Drinks','Bisleri',13,20,16,20,18,'2201','PIECE','Crate',24,480,96),
('Lays Classic Salted 52g','SNA001','Snacks','Lays',16,20,18,20,12,'2005','PIECE','Case',30,360,60),
('Kurkure Masala Munch 90g','SNA002','Snacks','Kurkure',16,20,18,20,12,'2106','PIECE','Case',30,300,60),
('Haldiram Aloo Bhujia 400g','SNA003','Snacks','Haldiram',88,110,98,115,12,'2106','PIECE','Case',12,144,24),
('Balaji Wafers Chaat Chaska 135g','SNA004','Snacks','Balaji',36,45,40,45,12,'2005','PIECE','Case',24,240,48),
('Bikano Navratan Mixture 1kg','SNA005','Snacks','Bikano',195,240,215,245,12,'2106','PIECE','Case',6,72,12)
) AS p(name,sku,cat,brand,pp,sp,wp,mrp,gst,hsn,unit,pack,psize,stock,minstock)
JOIN public.categories c ON c.name = p.cat;

-- Opening stock batches (3 batches for the first 10 products, 1 for the rest)
INSERT INTO public.batches (product_id, batch_number, purchase_price, quantity_base_units, remaining_quantity, expiry_date, created_at)
SELECT p.id, 'OPEN-' || p.sku, p.purchase_price, p.current_stock, p.current_stock, current_date + interval '9 months', now()
FROM public.products p;

INSERT INTO public.stock_movements (product_id, batch_id, type, quantity, note)
SELECT b.product_id, b.id, 'OPENING_STOCK', b.quantity_base_units, 'Opening stock' FROM public.batches b;
