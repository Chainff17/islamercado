-- ===== Suscripciones de vendedores =====
-- Aplicada en el proyecto de IslaMercado como migración "seller_subscriptions".
-- Idempotente: se puede volver a ejecutar sin duplicar datos.

-- Perfiles faltantes (cuentas creadas antes del trigger handle_new_user)
INSERT INTO public.profiles (id, username)
SELECT u.id, split_part(u.email, '@', 1) FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT DO NOTHING;

-- Administradores
CREATE TABLE IF NOT EXISTS public.app_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin(p_uid uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_uid IS NOT NULL AND EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = p_uid);
$$;

DROP POLICY IF EXISTS app_admins_select ON public.app_admins;
CREATE POLICY app_admins_select ON public.app_admins FOR SELECT TO authenticated USING (public.is_admin());

-- Ajustes editables por el admin (datos de pago, tasa CUP)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_settings_select ON public.app_settings;
CREATE POLICY app_settings_select ON public.app_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS app_settings_admin_write ON public.app_settings;
CREATE POLICY app_settings_admin_write ON public.app_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.app_settings (key, value) VALUES
  ('cup_rate', '360'),
  ('payment_instructions', E'Transfermóvil / EnZona: (pon aquí tu número de tarjeta y el móvil a confirmar)\nZelle: (pon aquí tu correo o teléfono de Zelle)\nEfectivo: coordina la entrega por WhatsApp.\n\nEn el concepto escribe tu usuario de IslaMercado.'),
  ('admin_whatsapp', '')
ON CONFLICT (key) DO NOTHING;

-- Planes
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  tagline text,
  price_usd numeric(10,2) NOT NULL CHECK (price_usd >= 0),
  max_listings int CHECK (max_listings IS NULL OR max_listings > 0),
  max_photos int NOT NULL DEFAULT 4 CHECK (max_photos BETWEEN 1 AND 20),
  max_featured int NOT NULL DEFAULT 0 CHECK (max_featured >= 0),
  badge text CHECK (badge IS NULL OR badge IN ('verificado','tienda')),
  stats boolean NOT NULL DEFAULT false,
  perks text[] NOT NULL DEFAULT '{}',
  highlight boolean NOT NULL DEFAULT false,
  sort int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plans_select ON public.subscription_plans;
CREATE POLICY plans_select ON public.subscription_plans FOR SELECT USING (true);
DROP POLICY IF EXISTS plans_admin_write ON public.subscription_plans;
CREATE POLICY plans_admin_write ON public.subscription_plans FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.subscription_plans (id, name, tagline, price_usd, max_listings, max_photos, max_featured, badge, stats, perks, highlight, sort) VALUES
  ('emprendedor', 'Emprendedor', 'Para empezar a vender lo que tienes en casa', 5, 5, 4, 0, NULL, false,
    ARRAY['Hasta 5 anuncios activos','4 fotos por anuncio','Ventas con carrito y pedidos','Contacto por WhatsApp y mensajes'], false, 1),
  ('negocio', 'Negocio', 'Para quien vende todas las semanas', 12, 25, 8, 3, 'verificado', true,
    ARRAY['Hasta 25 anuncios activos','8 fotos por anuncio','3 anuncios destacados','Insignia «Vendedor verificado»','Estadísticas de visitas'], true, 2),
  ('tienda', 'Tienda', 'Para tiendas y mipymes con catálogo grande', 25, NULL, 12, 10, 'tienda', true,
    ARRAY['Anuncios ilimitados','12 fotos por anuncio','10 anuncios destacados','Insignia «Tienda oficial»','Aparece en «Tiendas oficiales» de la portada','Estadísticas de visitas'], false, 3)
ON CONFLICT (id) DO NOTHING;

-- Suscripciones
CREATE TABLE IF NOT EXISTS public.seller_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.subscription_plans(id),
  months int NOT NULL CHECK (months IN (1,3,6,12)),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL CHECK (currency IN ('USD','CUP','MLC')),
  payment_method text NOT NULL,
  payment_reference text CHECK (payment_reference IS NULL OR length(payment_reference) <= 120),
  receipt_path text,
  notes text CHECK (notes IS NULL OR length(notes) <= 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','rejected','cancelled')),
  admin_note text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'active' OR (starts_at IS NOT NULL AND expires_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_one_pending ON public.seller_subscriptions(user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_active ON public.seller_subscriptions(user_id, expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.seller_subscriptions(status, created_at DESC);
ALTER TABLE public.seller_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subs_select ON public.seller_subscriptions;
CREATE POLICY subs_select ON public.seller_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
-- Escrituras solo por RPC (SECURITY DEFINER)

REVOKE ALL ON public.seller_subscriptions FROM anon;
GRANT SELECT ON public.seller_subscriptions TO authenticated;
GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT UPDATE ON public.subscription_plans TO authenticated;
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT SELECT ON public.app_admins TO authenticated;

-- Plan vigente de un vendedor
CREATE OR REPLACE FUNCTION public.active_plan_id(p_uid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.plan_id FROM public.seller_subscriptions s
  WHERE s.user_id = p_uid AND s.status = 'active' AND now() >= s.starts_at AND now() < s.expires_at
  ORDER BY s.expires_at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.seller_is_active(p_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin(p_uid) OR public.active_plan_id(p_uid) IS NOT NULL;
$$;

-- Visibilidad: los anuncios solo son públicos si el vendedor tiene suscripción vigente
DROP POLICY IF EXISTS listings_select ON public.listings;
CREATE POLICY listings_select ON public.listings FOR SELECT USING (
  (status = 'active' AND public.seller_is_active(seller_id)) OR auth.uid() = seller_id OR public.is_admin()
);

-- Límites del plan al publicar / reactivar / cambiar fotos / destacar
CREATE OR REPLACE FUNCTION public.enforce_seller_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan public.subscription_plans%ROWTYPE;
  v_plan_id text;
  v_count int;
  v_photos int := coalesce(array_length(NEW.images, 1), 0);
BEGIN
  -- Operaciones internas (cancelar pedidos, etc.) no se bloquean
  IF current_setting('islamercado.skip_plan_check', true) = 'on' THEN RETURN NEW; END IF;
  -- Solo se controla al propio vendedor (no a compradores ni al sistema)
  IF auth.uid() IS NULL OR auth.uid() <> NEW.seller_id THEN RETURN NEW; END IF;
  IF public.is_admin(NEW.seller_id) THEN RETURN NEW; END IF;
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'active'
     AND NEW.images IS NOT DISTINCT FROM OLD.images
     AND NOT (NEW.featured AND NOT OLD.featured) THEN
    RETURN NEW;
  END IF;

  v_plan_id := public.active_plan_id(NEW.seller_id);
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Necesitas un plan de vendedor activo para publicar. Elige uno en «Planes».' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = v_plan_id;

  IF TG_OP = 'INSERT' OR OLD.status <> 'active' THEN
    IF v_plan.max_listings IS NOT NULL THEN
      SELECT count(*) INTO v_count FROM public.listings WHERE seller_id = NEW.seller_id AND status = 'active' AND id <> NEW.id;
      IF v_count >= v_plan.max_listings THEN
        RAISE EXCEPTION 'Tu plan % permite % anuncios activos. Pausa alguno o mejora tu plan.', v_plan.name, v_plan.max_listings USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  IF v_photos > v_plan.max_photos AND (TG_OP = 'INSERT' OR NEW.images IS DISTINCT FROM OLD.images) THEN
    RAISE EXCEPTION 'Tu plan % permite % fotos por anuncio.', v_plan.name, v_plan.max_photos USING ERRCODE = 'P0001';
  END IF;

  IF NEW.featured AND (TG_OP = 'INSERT' OR NOT OLD.featured OR OLD.status <> 'active') THEN
    SELECT count(*) INTO v_count FROM public.listings WHERE seller_id = NEW.seller_id AND status = 'active' AND featured AND id <> NEW.id;
    IF v_count >= v_plan.max_featured THEN
      IF v_plan.max_featured = 0 THEN
        RAISE EXCEPTION 'Tu plan % no incluye anuncios destacados.', v_plan.name USING ERRCODE = 'P0001';
      END IF;
      RAISE EXCEPTION 'Tu plan % permite % anuncios destacados a la vez.', v_plan.name, v_plan.max_featured USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enforce_seller_plan ON public.listings;
CREATE TRIGGER trg_enforce_seller_plan BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_seller_plan();

-- Estado del vendedor actual (para la app)
CREATE OR REPLACE FUNCTION public.my_seller_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_sub public.seller_subscriptions%ROWTYPE; v_pending public.seller_subscriptions%ROWTYPE; v_last public.seller_subscriptions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('is_admin', false); END IF;
  SELECT * INTO v_sub FROM public.seller_subscriptions
    WHERE user_id = v_uid AND status = 'active' AND now() >= starts_at AND now() < expires_at
    ORDER BY expires_at DESC LIMIT 1;
  SELECT * INTO v_pending FROM public.seller_subscriptions WHERE user_id = v_uid AND status = 'pending' LIMIT 1;
  SELECT * INTO v_last FROM public.seller_subscriptions WHERE user_id = v_uid ORDER BY coalesce(reviewed_at, created_at) DESC LIMIT 1;
  RETURN jsonb_build_object(
    'is_admin', public.is_admin(v_uid),
    'subscription', CASE WHEN v_sub.id IS NULL THEN NULL ELSE to_jsonb(v_sub) END,
    'pending', CASE WHEN v_pending.id IS NULL THEN NULL ELSE to_jsonb(v_pending) END,
    'last', CASE WHEN v_last.id IS NULL THEN NULL ELSE to_jsonb(v_last) END,
    'active_listings', (SELECT count(*) FROM public.listings WHERE seller_id = v_uid AND status = 'active'),
    'featured_listings', (SELECT count(*) FROM public.listings WHERE seller_id = v_uid AND status = 'active' AND featured),
    'pending_reviews', CASE WHEN public.is_admin(v_uid) THEN (SELECT count(*) FROM public.seller_subscriptions WHERE status = 'pending') ELSE 0 END
  );
END; $$;

-- Importe calculado en el servidor (descuento por duración)
CREATE OR REPLACE FUNCTION public.subscription_price(p_plan text, p_months int, p_currency text)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_price numeric; v_rate numeric; v_disc numeric;
BEGIN
  SELECT price_usd INTO v_price FROM public.subscription_plans WHERE id = p_plan AND active;
  IF v_price IS NULL THEN RAISE EXCEPTION 'Plan no disponible'; END IF;
  v_disc := CASE p_months WHEN 1 THEN 0 WHEN 3 THEN 0.10 WHEN 6 THEN 0.15 WHEN 12 THEN 0.25 ELSE NULL END;
  IF v_disc IS NULL THEN RAISE EXCEPTION 'Duración no válida'; END IF;
  v_price := round(v_price * p_months * (1 - v_disc), 2);
  IF p_currency = 'CUP' THEN
    SELECT coalesce(nullif(value, '')::numeric, 360) INTO v_rate FROM public.app_settings WHERE key = 'cup_rate';
    RETURN round(v_price * coalesce(v_rate, 360));
  ELSIF p_currency IN ('USD','MLC') THEN
    RETURN v_price;
  END IF;
  RAISE EXCEPTION 'Moneda no válida';
END; $$;

-- El vendedor envía su solicitud con el comprobante de pago
CREATE OR REPLACE FUNCTION public.request_subscription(p_plan text, p_months int, p_currency text, p_method text, p_reference text, p_receipt text, p_notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_amount numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión'; END IF;
  IF EXISTS (SELECT 1 FROM public.seller_subscriptions WHERE user_id = v_uid AND status = 'pending') THEN
    RAISE EXCEPTION 'Ya tienes una solicitud pendiente de aprobación';
  END IF;
  IF coalesce(trim(p_method), '') = '' THEN RAISE EXCEPTION 'Indica el método de pago'; END IF;
  IF coalesce(trim(p_reference), '') = '' AND coalesce(trim(p_receipt), '') = '' AND p_method <> 'efectivo' THEN
    RAISE EXCEPTION 'Añade el número de transacción o una foto del comprobante';
  END IF;
  IF p_receipt IS NOT NULL AND p_receipt <> '' AND split_part(p_receipt, '/', 1) <> v_uid::text THEN
    RAISE EXCEPTION 'Comprobante no válido';
  END IF;
  v_amount := public.subscription_price(p_plan, p_months, p_currency);
  INSERT INTO public.seller_subscriptions (user_id, plan_id, months, amount, currency, payment_method, payment_reference, receipt_path, notes)
  VALUES (v_uid, p_plan, p_months, v_amount, p_currency, trim(p_method), nullif(trim(p_reference), ''), nullif(trim(p_receipt), ''), nullif(trim(p_notes), ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_subscription_request(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.seller_subscriptions SET status = 'cancelled', admin_note = 'Cancelada por el vendedor', reviewed_at = now()
  WHERE id = p_id AND user_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada o ya revisada'; END IF;
END; $$;

-- Activa una suscripción: mismo plan => se suma al tiempo restante; plan distinto => reemplaza desde hoy
CREATE OR REPLACE FUNCTION public._activate_subscription(p_id uuid, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.seller_subscriptions%ROWTYPE; v_start timestamptz := now(); v_cur public.seller_subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.seller_subscriptions WHERE id = p_id FOR UPDATE;
  SELECT * INTO v_cur FROM public.seller_subscriptions
    WHERE user_id = s.user_id AND status = 'active' AND expires_at > now() AND id <> s.id
    ORDER BY expires_at DESC LIMIT 1;
  IF v_cur.id IS NOT NULL THEN
    IF v_cur.plan_id = s.plan_id THEN
      v_start := v_cur.expires_at;
    ELSE
      UPDATE public.seller_subscriptions SET status = 'cancelled', admin_note = coalesce(admin_note || ' · ', '') || 'Reemplazada por cambio a plan ' || s.plan_id
        WHERE user_id = s.user_id AND status = 'active' AND id <> s.id;
    END IF;
  END IF;
  UPDATE public.seller_subscriptions
    SET status = 'active', starts_at = v_start, expires_at = v_start + make_interval(months => s.months),
        reviewed_by = auth.uid(), reviewed_at = now(), admin_note = nullif(trim(p_note), '')
    WHERE id = p_id;
END; $$;
REVOKE ALL ON FUNCTION public._activate_subscription(uuid, text) FROM public, anon, authenticated;

-- Aprobación / rechazo por el administrador
CREATE OR REPLACE FUNCTION public.admin_review_subscription(p_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.seller_subscriptions%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo el administrador puede revisar suscripciones'; END IF;
  SELECT * INTO s FROM public.seller_subscriptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF s.status <> 'pending' THEN RAISE EXCEPTION 'Esta solicitud ya fue revisada'; END IF;
  IF p_approve THEN
    PERFORM public._activate_subscription(p_id, p_note);
  ELSE
    IF coalesce(trim(p_note), '') = '' THEN RAISE EXCEPTION 'Indica el motivo del rechazo'; END IF;
    UPDATE public.seller_subscriptions SET status = 'rejected', admin_note = trim(p_note), reviewed_by = auth.uid(), reviewed_at = now() WHERE id = p_id;
  END IF;
END; $$;

-- Alta directa por el administrador (p. ej. pago en efectivo en persona)
CREATE OR REPLACE FUNCTION public.admin_grant_subscription(p_user uuid, p_plan text, p_months int, p_currency text DEFAULT 'USD', p_note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo el administrador puede asignar planes'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user) THEN RAISE EXCEPTION 'Usuario no encontrado'; END IF;
  UPDATE public.seller_subscriptions SET status = 'cancelled', admin_note = 'Sustituida por alta directa del administrador', reviewed_at = now()
    WHERE user_id = p_user AND status = 'pending';
  INSERT INTO public.seller_subscriptions (user_id, plan_id, months, amount, currency, payment_method, notes)
  VALUES (p_user, p_plan, p_months, public.subscription_price(p_plan, p_months, p_currency), p_currency, 'admin', 'Alta directa por el administrador')
  RETURNING id INTO v_id;
  PERFORM public._activate_subscription(v_id, coalesce(p_note, 'Alta directa'));
  RETURN v_id;
END; $$;

-- Cancelar o ampliar una suscripción activa
CREATE OR REPLACE FUNCTION public.admin_update_subscription(p_id uuid, p_action text, p_months int DEFAULT 1, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo el administrador puede modificar suscripciones'; END IF;
  IF p_action = 'cancel' THEN
    UPDATE public.seller_subscriptions SET status = 'cancelled', expires_at = least(expires_at, now()), admin_note = coalesce(nullif(trim(p_note), ''), 'Cancelada por el administrador'), reviewed_by = auth.uid(), reviewed_at = now()
      WHERE id = p_id AND status = 'active';
  ELSIF p_action = 'extend' THEN
    IF p_months NOT BETWEEN 1 AND 24 THEN RAISE EXCEPTION 'Meses no válidos'; END IF;
    UPDATE public.seller_subscriptions SET expires_at = greatest(expires_at, now()) + make_interval(months => p_months),
      admin_note = coalesce(admin_note || ' · ', '') || '+' || p_months || ' mes(es) por el administrador'
      WHERE id = p_id AND status = 'active';
  ELSE
    RAISE EXCEPTION 'Acción no válida';
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Suscripción no encontrada o no activa'; END IF;
END; $$;

-- Lista para el panel de administración (con datos del vendedor)
CREATE OR REPLACE FUNCTION public.admin_list_subscriptions(p_status text DEFAULT NULL)
RETURNS TABLE (id uuid, user_id uuid, username text, email text, phone text, plan_id text, months int, amount numeric, currency text,
  payment_method text, payment_reference text, receipt_path text, notes text, status text, admin_note text,
  reviewed_at timestamptz, starts_at timestamptz, expires_at timestamptz, created_at timestamptz, active_listings bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo el administrador'; END IF;
  RETURN QUERY
  SELECT s.id, s.user_id, p.username, u.email::text, p.phone, s.plan_id, s.months, s.amount, s.currency,
    s.payment_method, s.payment_reference, s.receipt_path, s.notes, s.status, s.admin_note,
    s.reviewed_at, s.starts_at, s.expires_at, s.created_at,
    (SELECT count(*) FROM public.listings l WHERE l.seller_id = s.user_id AND l.status = 'active')
  FROM public.seller_subscriptions s
  JOIN public.profiles p ON p.id = s.user_id
  LEFT JOIN auth.users u ON u.id = s.user_id
  WHERE p_status IS NULL OR s.status = p_status
     OR (p_status = 'expired' AND s.status = 'active' AND s.expires_at <= now())
  ORDER BY CASE s.status WHEN 'pending' THEN 0 ELSE 1 END, s.created_at DESC
  LIMIT 300;
END; $$;

-- Búsqueda de usuarios para alta directa
CREATE OR REPLACE FUNCTION public.admin_find_users(p_q text)
RETURNS TABLE (id uuid, username text, email text, plan_id text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo el administrador'; END IF;
  RETURN QUERY
  SELECT p.id, p.username, u.email::text, public.active_plan_id(p.id)
  FROM public.profiles p LEFT JOIN auth.users u ON u.id = p.id
  WHERE coalesce(trim(p_q), '') = '' OR p.username ILIKE '%' || p_q || '%' OR u.email ILIKE '%' || p_q || '%'
  ORDER BY p.created_at DESC LIMIT 20;
END; $$;

-- Insignias públicas de vendedores
CREATE OR REPLACE FUNCTION public.get_seller_badges(p_ids uuid[])
RETURNS TABLE (user_id uuid, plan_id text, badge text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT x.uid, pl.id, pl.badge
  FROM unnest(p_ids) AS x(uid)
  JOIN public.subscription_plans pl ON pl.id = public.active_plan_id(x.uid)
  WHERE pl.badge IS NOT NULL;
$$;

-- Tiendas oficiales para la portada
CREATE OR REPLACE FUNCTION public.get_official_stores()
RETURNS TABLE (user_id uuid, username text, province text, listings bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username,
    (SELECT l.province FROM public.listings l WHERE l.seller_id = p.id AND l.status = 'active' GROUP BY l.province ORDER BY count(*) DESC LIMIT 1),
    (SELECT count(*) FROM public.listings l WHERE l.seller_id = p.id AND l.status = 'active')
  FROM public.profiles p
  WHERE public.active_plan_id(p.id) = 'tienda'
  ORDER BY 4 DESC LIMIT 12;
$$;

-- Permisos de RPC
REVOKE ALL ON FUNCTION public.request_subscription(text,int,text,text,text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_subscription(text,int,text,text,text,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.cancel_subscription_request(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_subscription_request(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_review_subscription(uuid,boolean,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_subscription(uuid,boolean,text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_grant_subscription(uuid,text,int,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_subscription(uuid,text,int,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_update_subscription(uuid,text,int,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_subscription(uuid,text,int,text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_subscriptions(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_subscriptions(text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_find_users(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_find_users(text) TO authenticated;
REVOKE ALL ON FUNCTION public.my_seller_status() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_seller_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.subscription_price(text,int,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_badges(uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_official_stores() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seller_is_active(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.active_plan_id(uuid) TO anon, authenticated;

-- place_order: no se puede comprar a vendedores sin plan vigente
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
    IF r.status <> 'active' OR NOT public.seller_is_active(r.seller_id) THEN RAISE EXCEPTION 'La publicación "%" ya no está disponible', r.title; END IF;
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

  UPDATE listings l SET stock = l.stock - i.qty, status = CASE WHEN l.stock - i.qty <= 0 THEN 'sold' ELSE l.status END
    FROM _items i WHERE l.id = i.listing_id AND i.price_period IS NULL;

  IF p_listing_id IS NULL THEN DELETE FROM cart_items WHERE user_id = v_uid; END IF;
  RETURN v_ids;
END; $$;
REVOKE ALL ON FUNCTION public.place_order(text,text,text,text,text,text,text,uuid,int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.place_order(text,text,text,text,text,text,text,uuid,int) TO authenticated;

-- update_order_status: reponer stock al cancelar no depende del plan
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
    PERFORM set_config('islamercado.skip_plan_check', 'on', true);
    UPDATE listings l SET stock = l.stock + oi.quantity, status = CASE WHEN l.status = 'sold' THEN 'active' ELSE l.status END
      FROM order_items oi WHERE oi.order_id = p_order AND l.id = oi.listing_id AND l.price_period IS NULL;
    PERFORM set_config('islamercado.skip_plan_check', 'off', true);
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.update_order_status(uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid,text) TO authenticated;

-- Bucket privado para comprobantes de pago
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payment-receipts', 'payment-receipts', false, 5242880, ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS receipts_insert_own ON storage.objects;
CREATE POLICY receipts_insert_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS receipts_select_own_or_admin ON storage.objects;
CREATE POLICY receipts_select_own_or_admin ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-receipts' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
DROP POLICY IF EXISTS receipts_delete_own ON storage.objects;
CREATE POLICY receipts_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'payment-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Administrador inicial: dueño del proyecto
INSERT INTO public.app_admins (user_id)
SELECT id FROM auth.users WHERE lower(email) = 'chain.ff17@icloud.com'
ON CONFLICT DO NOTHING;

-- Vendedores de ejemplo con plan activo (para que sus anuncios sigan visibles)
INSERT INTO public.seller_subscriptions (user_id, plan_id, months, amount, currency, payment_method, notes, status, starts_at, expires_at, admin_note, reviewed_at)
SELECT v.uid, v.plan, 12, public.subscription_price(v.plan, 12, 'USD'), 'USD', 'admin', 'Cuenta de demostración', 'active', now(), now() + interval '12 months', 'Plan de demostración', now()
FROM (VALUES ('9f0e8037-0237-4a88-b80d-7e2cb69b80dd'::uuid, 'tienda'), ('7510d388-4cd4-463c-a86c-6d99b734578a'::uuid, 'negocio'), ('fc216e9a-65c1-4ce5-a56f-c129c996608a'::uuid, 'negocio')) AS v(uid, plan)
WHERE EXISTS (SELECT 1 FROM public.profiles WHERE id = v.uid)
  AND NOT EXISTS (SELECT 1 FROM public.seller_subscriptions s WHERE s.user_id = v.uid);
