export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          id: string
          section: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          section: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          section?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      batches: {
        Row: {
          batch_number: string | null
          created_at: string
          expiry_date: string | null
          id: string
          manufacturing_date: string | null
          product_id: string
          purchase_price: number
          quantity_base_units: number
          remaining_quantity: number
          supplier_id: string | null
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          manufacturing_date?: string | null
          product_id: string
          purchase_price?: number
          quantity_base_units?: number
          remaining_quantity?: number
          supplier_id?: string | null
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          manufacturing_date?: string | null
          product_id?: string
          purchase_price?: number
          quantity_base_units?: number
          remaining_quantity?: number
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_items: {
        Row: {
          batch_id: string | null
          bill_id: string
          cgst: number
          discount_amount: number
          discount_percent: number
          gst_percent: number
          hsn_code: string | null
          id: string
          pack_name: string | null
          pack_quantity: number
          pack_size: number
          piece_quantity: number
          product_id: string | null
          product_name: string
          quantity: number
          sgst: number
          sku: string | null
          taxable_amount: number
          total_amount: number
          unit_price: number
        }
        Insert: {
          batch_id?: string | null
          bill_id: string
          cgst?: number
          discount_amount?: number
          discount_percent?: number
          gst_percent?: number
          hsn_code?: string | null
          id?: string
          pack_name?: string | null
          pack_quantity?: number
          pack_size?: number
          piece_quantity?: number
          product_id?: string | null
          product_name: string
          quantity?: number
          sgst?: number
          sku?: string | null
          taxable_amount?: number
          total_amount?: number
          unit_price?: number
        }
        Update: {
          batch_id?: string | null
          bill_id?: string
          cgst?: number
          discount_amount?: number
          discount_percent?: number
          gst_percent?: number
          hsn_code?: string | null
          id?: string
          pack_name?: string | null
          pack_quantity?: number
          pack_size?: number
          piece_quantity?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          sgst?: number
          sku?: string | null
          taxable_amount?: number
          total_amount?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "bill_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_payments: {
        Row: {
          amount: number
          bill_id: string | null
          created_by: string | null
          customer_id: string | null
          id: string
          mode: Database["public"]["Enums"]["payment_mode"]
          paid_at: string
          reference_number: string | null
        }
        Insert: {
          amount?: number
          bill_id?: string | null
          created_by?: string | null
          customer_id?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["payment_mode"]
          paid_at?: string
          reference_number?: string | null
        }
        Update: {
          amount?: number
          bill_id?: string | null
          created_by?: string | null
          customer_id?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["payment_mode"]
          paid_at?: string
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          amount_due: number
          amount_paid: number
          bill_type: Database["public"]["Enums"]["bill_type"]
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_gstin: string | null
          customer_id: string | null
          customer_mobile: string | null
          customer_name: string | null
          deleted_at: string | null
          deleted_reason: string | null
          grand_total: number
          id: string
          invoice_date: string
          invoice_number: string
          is_deleted: boolean
          notes: string | null
          original_bill_id: string | null
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          round_off: number
          sub_total: number
          total_discount: number
          total_gst: number
          updated_at: string
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          bill_type?: Database["public"]["Enums"]["bill_type"]
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_gstin?: string | null
          customer_id?: string | null
          customer_mobile?: string | null
          customer_name?: string | null
          deleted_at?: string | null
          deleted_reason?: string | null
          grand_total?: number
          id?: string
          invoice_date?: string
          invoice_number: string
          is_deleted?: boolean
          notes?: string | null
          original_bill_id?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          round_off?: number
          sub_total?: number
          total_discount?: number
          total_gst?: number
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          bill_type?: Database["public"]["Enums"]["bill_type"]
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_gstin?: string | null
          customer_id?: string | null
          customer_mobile?: string | null
          customer_name?: string | null
          deleted_at?: string | null
          deleted_reason?: string | null
          grand_total?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          is_deleted?: boolean
          notes?: string | null
          original_bill_id?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          round_off?: number
          sub_total?: number
          total_discount?: number
          total_gst?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_original_bill_id_fkey"
            columns: ["original_bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      credit_note_items: {
        Row: {
          credit_note_id: string
          gst_amount: number
          gst_percent: number
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          sku: string | null
          taxable_amount: number
          total_amount: number
          unit_price: number
        }
        Insert: {
          credit_note_id: string
          gst_amount?: number
          gst_percent?: number
          id?: string
          product_id?: string | null
          product_name: string
          quantity?: number
          sku?: string | null
          taxable_amount?: number
          total_amount?: number
          unit_price?: number
        }
        Update: {
          credit_note_id?: string
          gst_amount?: number
          gst_percent?: number
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sku?: string | null
          taxable_amount?: number
          total_amount?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_items_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          adjustment_type: string
          created_at: string
          created_by: string | null
          credit_note_number: string
          customer_id: string | null
          customer_name: string | null
          gst_amount: number
          id: string
          net_amount: number
          note_date: string
          original_bill_id: string | null
          reason: string | null
          restock: boolean
          sub_total: number
        }
        Insert: {
          adjustment_type?: string
          created_at?: string
          created_by?: string | null
          credit_note_number: string
          customer_id?: string | null
          customer_name?: string | null
          gst_amount?: number
          id?: string
          net_amount?: number
          note_date?: string
          original_bill_id?: string | null
          reason?: string | null
          restock?: boolean
          sub_total?: number
        }
        Update: {
          adjustment_type?: string
          created_at?: string
          created_by?: string | null
          credit_note_number?: string
          customer_id?: string | null
          customer_name?: string | null
          gst_amount?: number
          id?: string
          net_amount?: number
          note_date?: string
          original_bill_id?: string | null
          reason?: string | null
          restock?: boolean
          sub_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_original_bill_id_fkey"
            columns: ["original_bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          mode: Database["public"]["Enums"]["payment_mode"]
          note: string | null
          paid_at: string
          reference_number: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          mode?: Database["public"]["Enums"]["payment_mode"]
          note?: string | null
          paid_at?: string
          reference_number?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          mode?: Database["public"]["Enums"]["payment_mode"]
          note?: string | null
          paid_at?: string
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          credit_limit: number
          email: string | null
          gstin: string | null
          id: string
          is_active: boolean
          is_deleted: boolean
          mobile: string | null
          name: string
          outstanding_balance: number
          pincode: string | null
          state: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          credit_limit?: number
          email?: string | null
          gstin?: string | null
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          mobile?: string | null
          name: string
          outstanding_balance?: number
          pincode?: string | null
          state?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          credit_limit?: number
          email?: string | null
          gstin?: string | null
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          mobile?: string | null
          name?: string
          outstanding_balance?: number
          pincode?: string | null
          state?: string | null
        }
        Relationships: []
      }
      day_closes: {
        Row: {
          bank_total: number
          bill_count: number
          cash_total: number
          cheque_total: number
          close_date: string
          closed_by: string | null
          counted_cash: number
          created_at: string
          credit_total: number
          id: string
          item_count: number
          notes: string | null
          opening_cash: number
          total_expenses: number
          total_sales: number
          upi_total: number
        }
        Insert: {
          bank_total?: number
          bill_count?: number
          cash_total?: number
          cheque_total?: number
          close_date: string
          closed_by?: string | null
          counted_cash?: number
          created_at?: string
          credit_total?: number
          id?: string
          item_count?: number
          notes?: string | null
          opening_cash?: number
          total_expenses?: number
          total_sales?: number
          upi_total?: number
        }
        Update: {
          bank_total?: number
          bill_count?: number
          cash_total?: number
          cheque_total?: number
          close_date?: string
          closed_by?: string | null
          counted_cash?: number
          created_at?: string
          credit_total?: number
          id?: string
          item_count?: number
          notes?: string | null
          opening_cash?: number
          total_expenses?: number
          total_sales?: number
          upi_total?: number
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          expense_category_id: string | null
          id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          expense_category_id?: string | null
          id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          expense_category_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_expense_category_id_fkey"
            columns: ["expense_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allow_pack_sale: boolean
          allow_piece_sale: boolean
          barcode: string | null
          base_unit: Database["public"]["Enums"]["unit_type"]
          brand: string | null
          category_id: string | null
          created_at: string
          current_stock: number
          description: string | null
          gst_percent: number
          hsn_code: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_deleted: boolean
          min_stock_alert: number
          mrp: number
          name: string
          pack_name: string
          pack_size: number
          purchase_price: number
          selling_price: number
          sku: string
          updated_at: string
          wholesale_price: number
        }
        Insert: {
          allow_pack_sale?: boolean
          allow_piece_sale?: boolean
          barcode?: string | null
          base_unit?: Database["public"]["Enums"]["unit_type"]
          brand?: string | null
          category_id?: string | null
          created_at?: string
          current_stock?: number
          description?: string | null
          gst_percent?: number
          hsn_code?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_deleted?: boolean
          min_stock_alert?: number
          mrp?: number
          name: string
          pack_name?: string
          pack_size?: number
          purchase_price?: number
          selling_price?: number
          sku: string
          updated_at?: string
          wholesale_price?: number
        }
        Update: {
          allow_pack_sale?: boolean
          allow_piece_sale?: boolean
          barcode?: string | null
          base_unit?: Database["public"]["Enums"]["unit_type"]
          brand?: string | null
          category_id?: string | null
          created_at?: string
          current_stock?: number
          description?: string | null
          gst_percent?: number
          hsn_code?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_deleted?: boolean
          min_stock_alert?: number
          mrp?: number
          name?: string
          pack_name?: string
          pack_size?: number
          purchase_price?: number
          selling_price?: number
          sku?: string
          updated_at?: string
          wholesale_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          staff_access_code: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          is_active?: boolean
          name?: string
          staff_access_code?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          staff_access_code?: string | null
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          batch_id: string | null
          gst_percent: number
          id: string
          product_id: string | null
          purchase_order_id: string
          quantity_base_units: number
          total_amount: number
          unit_price: number
        }
        Insert: {
          batch_id?: string | null
          gst_percent?: number
          id?: string
          product_id?: string | null
          purchase_order_id: string
          quantity_base_units?: number
          total_amount?: number
          unit_price?: number
        }
        Update: {
          batch_id?: string | null
          gst_percent?: number
          id?: string
          product_id?: string | null
          purchase_order_id?: string
          quantity_base_units?: number
          total_amount?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          amount_paid: number
          created_at: string
          created_by: string | null
          grand_total: number
          id: string
          invoice_date: string
          invoice_number: string | null
          status: Database["public"]["Enums"]["po_status"]
          sub_total: number
          supplier_id: string | null
          total_gst: number
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          grand_total?: number
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          sub_total?: number
          supplier_id?: string | null
          total_gst?: number
        }
        Update: {
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          grand_total?: number
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          status?: Database["public"]["Enums"]["po_status"]
          sub_total?: number
          supplier_id?: string | null
          total_gst?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_profile: {
        Row: {
          address: string | null
          auto_print: boolean
          bank_account: string | null
          bank_name: string | null
          default_gst_slab: number
          email: string | null
          gstin: string | null
          id: string
          ifsc: string | null
          invoice_prefix: string
          invoice_start_number: number
          logo_url: string | null
          phone: string | null
          shop_name: string
          state_code: string | null
          terms: string | null
          theme: string
          updated_at: string
          whatsapp_template: string | null
        }
        Insert: {
          address?: string | null
          auto_print?: boolean
          bank_account?: string | null
          bank_name?: string | null
          default_gst_slab?: number
          email?: string | null
          gstin?: string | null
          id?: string
          ifsc?: string | null
          invoice_prefix?: string
          invoice_start_number?: number
          logo_url?: string | null
          phone?: string | null
          shop_name?: string
          state_code?: string | null
          terms?: string | null
          theme?: string
          updated_at?: string
          whatsapp_template?: string | null
        }
        Update: {
          address?: string | null
          auto_print?: boolean
          bank_account?: string | null
          bank_name?: string | null
          default_gst_slab?: number
          email?: string | null
          gstin?: string | null
          id?: string
          ifsc?: string | null
          invoice_prefix?: string
          invoice_start_number?: number
          logo_url?: string | null
          phone?: string | null
          shop_name?: string
          state_code?: string | null
          terms?: string | null
          theme?: string
          updated_at?: string
          whatsapp_template?: string | null
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          batch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          type: Database["public"]["Enums"]["movement_type"]
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          type: Database["public"]["Enums"]["movement_type"]
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          type?: Database["public"]["Enums"]["movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          mode: Database["public"]["Enums"]["payment_mode"]
          note: string | null
          paid_at: string
          reference_number: string | null
          supplier_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["payment_mode"]
          note?: string | null
          paid_at?: string
          reference_number?: string | null
          supplier_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["payment_mode"]
          note?: string | null
          paid_at?: string
          reference_number?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          gstin: string | null
          id: string
          is_active: boolean
          mobile: string | null
          name: string
          outstanding_balance: number
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          gstin?: string | null
          id?: string
          is_active?: boolean
          mobile?: string | null
          name: string
          outstanding_balance?: number
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          gstin?: string | null
          id?: string
          is_active?: boolean
          mobile?: string | null
          name?: string
          outstanding_balance?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_current_user: {
        Args: { _name: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      create_bill: {
        Args: { p_bill: Json; p_items: Json; p_payments: Json }
        Returns: Json
      }
      create_credit_note: {
        Args: { p_items: Json; p_note: Json }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      next_credit_note_number: { Args: never; Returns: string }
      next_invoice_number: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "ADMIN" | "SALES" | "ACCOUNTANT" | "STOCK_MANAGER"
      bill_type: "SALE" | "SALE_RETURN" | "DRAFT" | "HOLD"
      movement_type:
        | "PURCHASE"
        | "SALE"
        | "SALE_RETURN"
        | "PURCHASE_RETURN"
        | "ADJUSTMENT"
        | "OPENING_STOCK"
        | "DAMAGE"
      payment_mode:
        | "CASH"
        | "UPI"
        | "CREDIT"
        | "CHEQUE"
        | "BANK_TRANSFER"
        | "SPLIT"
      payment_status: "PAID" | "PARTIAL" | "UNPAID"
      po_status: "PENDING" | "COMPLETED" | "CANCELLED"
      unit_type: "PIECE" | "KG" | "LITRE" | "GRAM" | "ML" | "BOX" | "BUNDLE"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["ADMIN", "SALES", "ACCOUNTANT", "STOCK_MANAGER"],
      bill_type: ["SALE", "SALE_RETURN", "DRAFT", "HOLD"],
      movement_type: [
        "PURCHASE",
        "SALE",
        "SALE_RETURN",
        "PURCHASE_RETURN",
        "ADJUSTMENT",
        "OPENING_STOCK",
        "DAMAGE",
      ],
      payment_mode: [
        "CASH",
        "UPI",
        "CREDIT",
        "CHEQUE",
        "BANK_TRANSFER",
        "SPLIT",
      ],
      payment_status: ["PAID", "PARTIAL", "UNPAID"],
      po_status: ["PENDING", "COMPLETED", "CANCELLED"],
      unit_type: ["PIECE", "KG", "LITRE", "GRAM", "ML", "BOX", "BUNDLE"],
    },
  },
} as const
