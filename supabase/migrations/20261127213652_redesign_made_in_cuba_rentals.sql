-- =====================================================================
-- IslaMercado · Rediseño (nov 2026)
-- Consolida las migraciones aplicadas en el proyecto xaumytmotnokdqbnxjgx:
--   20261127213652 made_in_cuba_price_period_currency_orders
--   20261127213724 rental_safe_cancel_and_seed_cuba (parte de esquema/funciones + 2 anuncios demo)
--   20261127213946 listings_price_ref
-- Idempotente: puede ejecutarse de nuevo sin efectos secundarios.
-- =====================================================================

-- 1) Nuevos campos en listings -----------------------------------------
-- "Hecho en Cuba" (sello de producción nacional)
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS made_in_cuba boolean NOT NULL DEFAULT false;
-- Alquileres: el precio se cobra por periodo (320 USD / mes)
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS price_period text;
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_price_period_check;
ALTER TABLE public.listings ADD CONSTRAINT listings_price_period_check
  CHECK (price_period IS NULL OR price_period IN ('mes','semana','dia','noche','hora'));

-- Precio de referencia en USD para ordenar/filtrar entre monedas.
-- Nota: price_usd guarda el importe en la moneda del anuncio (USD, CUP o MLC).
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS price_ref numeric
  GENERATED ALWAYS AS (CASE WHEN currency = 'CUP' THEN round(price_usd / 360.0, 2) ELSE price_usd END) STORED;
CREATE INDEX IF NOT EXISTS idx_listings_price_ref ON public.listings(price_ref);
COMMENT ON COLUMN public.listings.price_ref IS 'Precio de referencia en USD (1 USD = 360 CUP, 1 MLC = 1 USD) para ordenar y filtrar entre monedas';
CREATE INDEX IF NOT EXISTS idx_listings_made_in_cuba ON public.listings(made_in_cuba) WHERE made_in_cuba;

-- 2) place_order: un pedido por (vendedor, moneda); alquileres sin stock --
CREATE OR REPLACE FUNCTION public.place_order(p_payment text, p_name text, p_phone text, p_province text, p_city text, p_address text, p_notes text, p_listing_id uuid DEFAULT NULL, p_qty int DEFAULT 1)
RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); g record; v_order uuid; v_ids uuid[] := '{}'; r record; v_total numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión'; END IF;
  IF coalesce(trim(p_name),'') = '' OR coalesce(trim(p_phone),'') = '' OR coalesce(trim(p_province),'') = '' THEN
    RAISE EXCEPTION 'Completa nombre, teléfono y provincia de entrega';
  END IF;

  CREATE TEMP TABLE _items ON COMMIT DROP AS
    SELECT l.id AS listing_id, l.seller_id, l.title, l.price_usd AS price, l.currency, l.images[1] AS image, l.stock, l.status, l.price_period, x.qty
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

  FOR g IN SELECT DISTINCT seller_id, currency FROM _items LOOP
    SELECT sum(price*qty) INTO v_total FROM _items WHERE seller_id = g.seller_id AND currency = g.currency;
    INSERT INTO orders (buyer_id, seller_id, status, total, currency, payment_method, delivery_name, delivery_phone, delivery_province, delivery_city, delivery_address, notes)
    VALUES (v_uid, g.seller_id, 'pending', v_total, g.currency, p_payment, trim(p_name), trim(p_phone), p_province, nullif(trim(p_city),''), nullif(trim(p_address),''), nullif(trim(p_notes),''))
    RETURNING id INTO v_order;
    INSERT INTO order_items (order_id, listing_id, title, price, quantity, image)
      SELECT v_order, listing_id, title, price, qty, image FROM _items WHERE seller_id = g.seller_id AND currency = g.currency;
    INSERT INTO messages (listing_id, sender_id, receiver_id, body)
      SELECT (SELECT listing_id FROM _items WHERE seller_id = g.seller_id AND currency = g.currency LIMIT 1), v_uid, g.seller_id,
        'Nueva solicitud #' || upper(left(v_order::text,8)) || ': ' || (SELECT string_agg(qty || ' x ' || title, ', ') FROM _items WHERE seller_id = g.seller_id AND currency = g.currency) || '. Total ' || trim(to_char(v_total, 'FM999G999G990D00')) || ' ' || g.currency || '. Entrega en ' || p_province || '. Revisa "Mis ventas" para confirmar.';
    v_ids := v_ids || v_order;
  END LOOP;

  -- Los alquileres (price_period) no consumen stock
  UPDATE listings l SET stock = l.stock - i.qty, status = CASE WHEN l.stock - i.qty <= 0 THEN 'sold' ELSE l.status END
    FROM _items i WHERE l.id = i.listing_id AND i.price_period IS NULL;

  IF p_listing_id IS NULL THEN DELETE FROM cart_items WHERE user_id = v_uid; END IF;
  RETURN v_ids;
END; $$;
REVOKE ALL ON FUNCTION public.place_order(text,text,text,text,text,text,text,uuid,int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.place_order(text,text,text,text,text,text,text,uuid,int) TO authenticated;

-- 3) update_order_status: al cancelar solo repone stock de ventas, no de alquileres
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
      FROM order_items oi WHERE oi.order_id = p_order AND l.id = oi.listing_id AND l.price_period IS NULL;
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.update_order_status(uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid,text) TO authenticated;

-- 4) Anuncios demo "Hecho en Cuba" (imágenes en public/seed/) -------------
-- (Los ajustes de títulos/precios de los anuncios demo existentes se aplicaron
--  directamente en el proyecto y no se repiten aquí.)
INSERT INTO public.listings (seller_id, category_id, title, description, price_usd, currency, negotiable, condition, province, city, images, phone, status, views, stock, made_in_cuba)
SELECT 'fc216e9a-65c1-4ce5-a56f-c129c996608a', (SELECT id FROM public.categories WHERE slug='moda'),
  'Guayabera de lino hecha a mano, talla M',
  'Guayabera clásica de lino 100%, cosida a mano en Santiago de Cuba. Cuatro bolsillos y alforzas verticales. También en tallas S, L y XL por encargo.',
  6500, 'CUP', true, 'nuevo', 'Santiago de Cuba', 'Santiago de Cuba', ARRAY['/seed/guayabera.jpg'], '5359876543', 'active', 41, 6, true
WHERE EXISTS (SELECT 1 FROM public.profiles WHERE id = 'fc216e9a-65c1-4ce5-a56f-c129c996608a')
  AND NOT EXISTS (SELECT 1 FROM public.listings WHERE title LIKE 'Guayabera de lino%');

INSERT INTO public.listings (seller_id, category_id, title, description, price_usd, currency, negotiable, condition, province, city, images, phone, status, views, stock, made_in_cuba)
SELECT '7510d388-4cd4-463c-a86c-6d99b734578a', (SELECT id FROM public.categories WHERE slug='hogar'),
  'Sillón de madera y rejilla, artesanal',
  'Sillón de caoba con asiento y respaldo de rejilla tejida a mano por artesanos de Camagüey. Incluye cojín de lino. Entrega coordinada en todo el país.',
  18500, 'CUP', true, 'nuevo', 'Camagüey', 'Camagüey', ARRAY['/seed/sillon.jpg'], NULL, 'active', 58, 2, true
WHERE EXISTS (SELECT 1 FROM public.profiles WHERE id = '7510d388-4cd4-463c-a86c-6d99b734578a')
  AND NOT EXISTS (SELECT 1 FROM public.listings WHERE title LIKE 'Sillón de madera%');
