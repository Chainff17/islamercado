-- Isla Mercado · funcionalidades estilo Mercado Libre para Cuba
-- (aplicado al proyecto xaumytmotnokdqbnxjgx el 2026-11-27)

-- ── Listings: moneda, stock, ofertas, envío ─────────────────────────────
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 1;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS original_price numeric;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS free_shipping boolean NOT NULL DEFAULT false;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_condition_check;
ALTER TABLE public.listings ADD CONSTRAINT listings_condition_check CHECK (condition IN ('nuevo','como_nuevo','like-new','usado','mal'));
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_status_check;
ALTER TABLE public.listings ADD CONSTRAINT listings_status_check CHECK (status IN ('active','sold','reserved','paused'));
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_currency_check;
ALTER TABLE public.listings ADD CONSTRAINT listings_currency_check CHECK (currency IN ('USD','CUP','MLC'));

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_listings_status_created ON public.listings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_category ON public.listings(category_id, status);
CREATE INDEX IF NOT EXISTS idx_listings_province ON public.listings(province, status);
CREATE INDEX IF NOT EXISTS idx_listings_price ON public.listings(price_usd);
CREATE INDEX IF NOT EXISTS idx_listings_search ON public.listings USING gin (title gin_trgm_ops);

-- ── Nuevas tablas ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CONSTRAINT orders_status_check CHECK (status IN ('pending','confirmed','shipped','delivered','cancelled')),
  total numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD' CONSTRAINT orders_currency_check CHECK (currency IN ('USD','CUP','MLC')),
  payment_method text NOT NULL DEFAULT 'transfermovil' CONSTRAINT orders_payment_check CHECK (payment_method IN ('transfermovil','zelle','efectivo_cup','efectivo_usd','efectivo_mlc','contra_entrega')),
  delivery_province text, delivery_city text, delivery_address text, delivery_phone text, delivery_name text, notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  title text NOT NULL, price numeric NOT NULL, quantity integer NOT NULL DEFAULT 1, image text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  asker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question text NOT NULL, answer text, answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cart_user ON public.cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON public.orders(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON public.orders(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_listing ON public.questions(listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

-- ── RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY cart_select_own ON public.cart_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY cart_insert_own ON public.cart_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY cart_update_own ON public.cart_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY cart_delete_own ON public.cart_items FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY orders_select_participants ON public.orders FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY order_items_select_participants ON public.order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())));
CREATE POLICY questions_select_public ON public.questions FOR SELECT USING (true);
CREATE POLICY questions_insert_asker ON public.questions FOR INSERT WITH CHECK (auth.uid() = asker_id);
CREATE POLICY questions_update_seller ON public.questions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.seller_id = auth.uid()));

-- ── updated_at ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_orders_touch ON public.orders;
CREATE TRIGGER trg_orders_touch BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_listings_touch ON public.listings;
CREATE TRIGGER trg_listings_touch BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated;

-- ── Checkout atómico ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.place_order(p_payment text, p_name text, p_phone text, p_province text, p_city text, p_address text, p_notes text, p_listing_id uuid DEFAULT NULL, p_qty int DEFAULT 1)
RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_seller uuid; v_order uuid; v_ids uuid[] := '{}'; r record; v_total numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión'; END IF;
  IF coalesce(trim(p_name),'') = '' OR coalesce(trim(p_phone),'') = '' OR coalesce(trim(p_province),'') = '' THEN
    RAISE EXCEPTION 'Completa nombre, teléfono y provincia de entrega';
  END IF;

  CREATE TEMP TABLE _items ON COMMIT DROP AS
    SELECT l.id AS listing_id, l.seller_id, l.title, l.price_usd AS price, l.images[1] AS image, l.stock, l.status, x.qty
    FROM (
      SELECT p_listing_id AS listing_id, greatest(p_qty,1) AS qty WHERE p_listing_id IS NOT NULL
      UNION ALL
      SELECT c.listing_id, c.quantity FROM cart_items c WHERE c.user_id = v_uid AND p_listing_id IS NULL
    ) x JOIN listings l ON l.id = x.listing_id
    FOR UPDATE OF l;

  IF NOT EXISTS (SELECT 1 FROM _items) THEN RAISE EXCEPTION 'No hay productos para comprar'; END IF;
  FOR r IN SELECT * FROM _items LOOP
    IF r.seller_id = v_uid THEN RAISE EXCEPTION 'No puedes comprar tu propia publicación: %', r.title; END IF;
    IF r.status <> 'active' THEN RAISE EXCEPTION 'La publicación "%" ya no está disponible', r.title; END IF;
    IF r.qty > r.stock THEN RAISE EXCEPTION 'Stock insuficiente para "%" (disponibles: %)', r.title, r.stock; END IF;
  END LOOP;

  FOR v_seller IN SELECT DISTINCT seller_id FROM _items LOOP
    SELECT sum(price*qty) INTO v_total FROM _items WHERE seller_id = v_seller;
    INSERT INTO orders (buyer_id, seller_id, status, total, currency, payment_method, delivery_name, delivery_phone, delivery_province, delivery_city, delivery_address, notes)
    VALUES (v_uid, v_seller, 'pending', v_total, 'USD', p_payment, trim(p_name), trim(p_phone), p_province, nullif(trim(p_city),''), nullif(trim(p_address),''), nullif(trim(p_notes),''))
    RETURNING id INTO v_order;
    INSERT INTO order_items (order_id, listing_id, title, price, quantity, image)
      SELECT v_order, listing_id, title, price, qty, image FROM _items WHERE seller_id = v_seller;
    INSERT INTO messages (listing_id, sender_id, receiver_id, body)
      SELECT (SELECT listing_id FROM _items WHERE seller_id = v_seller LIMIT 1), v_uid, v_seller,
        '🛒 Nueva compra #' || upper(left(v_order::text,8)) || ': ' || (SELECT string_agg(qty || ' x ' || title, ', ') FROM _items WHERE seller_id = v_seller) || '. Total $' || v_total || ' USD. Entrega en ' || p_province || '. Revisa "Mis ventas" para confirmar.';
    v_ids := v_ids || v_order;
  END LOOP;

  UPDATE listings l SET stock = l.stock - i.qty, status = CASE WHEN l.stock - i.qty <= 0 THEN 'sold' ELSE l.status END
    FROM _items i WHERE l.id = i.listing_id;

  IF p_listing_id IS NULL THEN DELETE FROM cart_items WHERE user_id = v_uid; END IF;
  RETURN v_ids;
END; $$;

CREATE OR REPLACE FUNCTION public.update_order_status(p_order uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); o orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado'; END IF;
  IF o.status IN ('delivered','cancelled') THEN RAISE EXCEPTION 'El pedido ya está cerrado'; END IF;
  IF v_uid = o.seller_id THEN
    IF p_status NOT IN ('confirmed','shipped','delivered','cancelled') THEN RAISE EXCEPTION 'Estado no válido'; END IF;
  ELSIF v_uid = o.buyer_id THEN
    IF p_status = 'cancelled' AND o.status <> 'pending' THEN RAISE EXCEPTION 'Solo puedes cancelar pedidos pendientes'; END IF;
    IF p_status NOT IN ('cancelled','delivered') THEN RAISE EXCEPTION 'Estado no válido'; END IF;
  ELSE
    RAISE EXCEPTION 'No autorizado';
  END IF;
  UPDATE orders SET status = p_status WHERE id = p_order;
  IF p_status = 'cancelled' THEN
    UPDATE listings l SET stock = l.stock + oi.quantity, status = CASE WHEN l.status = 'sold' THEN 'active' ELSE l.status END
      FROM order_items oi WHERE oi.order_id = p_order AND l.id = oi.listing_id;
  END IF;
END; $$;

REVOKE ALL ON FUNCTION public.place_order(text,text,text,text,text,text,text,uuid,int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.place_order(text,text,text,text,text,text,text,uuid,int) TO authenticated;
REVOKE ALL ON FUNCTION public.update_order_status(uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid,text) TO authenticated;

-- ── Privilegios de la API (antes faltaban: anon/authenticated no podían leer) ──
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.categories, public.listings, public.profiles, public.reviews, public.messages, public.favorites, public.cart_items, public.orders, public.order_items, public.questions FROM anon, authenticated;
REVOKE ALL ON public.cart_items, public.orders, public.order_items FROM anon;
GRANT SELECT ON public.categories, public.listings, public.profiles, public.reviews, public.questions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT SELECT ON public.orders, public.order_items TO authenticated;
GRANT INSERT, UPDATE ON public.questions TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_listing_views(uuid) TO anon, authenticated;
