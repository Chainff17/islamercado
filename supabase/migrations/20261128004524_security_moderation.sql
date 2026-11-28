-- ===== Seguridad y moderación =====
-- Suspensiones, denuncias, bloqueo de anuncios, registro de acciones del admin,
-- límites anti-spam, integridad de datos y verificación en 2 pasos para el admin.
-- Idempotente.

-- ---------------------------------------------------------------------------
-- 1. Rol de administrador y verificación en 2 pasos (MFA)
-- ---------------------------------------------------------------------------
-- Rol puro (¿está en app_admins?), sin tener en cuenta la sesión.
CREATE OR REPLACE FUNCTION public.has_admin_role(p_uid uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_uid IS NOT NULL AND EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = p_uid);
$$;

-- Permisos de admin efectivos. Si el admin activó la verificación en 2 pasos,
-- su sesión actual debe haberla superado (aal2); si no, no tiene permisos de admin.
CREATE OR REPLACE FUNCTION public.is_admin(p_uid uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_uid IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = p_uid)
    AND (
      p_uid IS DISTINCT FROM auth.uid()
      OR coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      OR NOT EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = p_uid AND f.status = 'verified')
    );
$$;

-- ---------------------------------------------------------------------------
-- 2. Suspensiones
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_bans (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  banned_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bans_select ON public.user_bans;
CREATE POLICY bans_select ON public.user_bans FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
REVOKE ALL ON public.user_bans FROM anon;
GRANT SELECT ON public.user_bans TO authenticated;

CREATE OR REPLACE FUNCTION public.is_banned(p_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_uid IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_bans WHERE user_id = p_uid);
$$;

-- Un vendedor suspendido deja de ser visible aunque tenga plan
CREATE OR REPLACE FUNCTION public.seller_is_active(p_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT public.is_banned(p_uid) AND (public.has_admin_role(p_uid) OR public.active_plan_id(p_uid) IS NOT NULL);
$$;

-- ---------------------------------------------------------------------------
-- 3. Registro de acciones del administrador
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit(created_at DESC);
ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_select ON public.admin_audit;
CREATE POLICY audit_select ON public.admin_audit FOR SELECT TO authenticated USING (public.is_admin());
REVOKE ALL ON public.admin_audit FROM anon, authenticated;
GRANT SELECT ON public.admin_audit TO authenticated;

CREATE OR REPLACE FUNCTION public._audit(p_action text, p_type text, p_id text, p_details jsonb DEFAULT '{}')
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.admin_audit (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), p_action, p_type, p_id, coalesce(p_details, '{}'));
$$;
REVOKE ALL ON FUNCTION public._audit(text, text, text, jsonb) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.audit_subscription_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_admin_role(auth.uid())
     AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.expires_at IS DISTINCT FROM NEW.expires_at) THEN
    PERFORM public._audit('subscription_' || NEW.status, 'subscription', NEW.id::text,
      jsonb_build_object('user_id', NEW.user_id, 'plan', NEW.plan_id, 'from', OLD.status, 'to', NEW.status,
                         'amount', NEW.amount, 'currency', NEW.currency, 'expires_at', NEW.expires_at, 'note', NEW.admin_note));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_audit_subscription ON public.seller_subscriptions;
CREATE TRIGGER trg_audit_subscription AFTER UPDATE ON public.seller_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.audit_subscription_change();

CREATE OR REPLACE FUNCTION public.audit_config_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF TG_TABLE_NAME = 'app_settings' THEN
      PERFORM public._audit('setting_changed', 'setting', NEW.key,
        jsonb_build_object('value', left(NEW.value, 300)));
    ELSE
      PERFORM public._audit('plan_changed', 'plan', NEW.id,
        jsonb_build_object('price_usd', NEW.price_usd, 'max_listings', NEW.max_listings, 'max_photos', NEW.max_photos,
                           'max_featured', NEW.max_featured, 'active', NEW.active));
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_audit_settings ON public.app_settings;
CREATE TRIGGER trg_audit_settings AFTER INSERT OR UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_config_change();
DROP TRIGGER IF EXISTS trg_audit_plans ON public.subscription_plans;
CREATE TRIGGER trg_audit_plans AFTER UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.audit_config_change();

-- ---------------------------------------------------------------------------
-- 4. Anuncios: bloqueo por moderación + integridad + límites
-- ---------------------------------------------------------------------------
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS blocked_at timestamptz;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS blocked_reason text;

DO $$ BEGIN
  ALTER TABLE public.listings ADD CONSTRAINT listings_description_len CHECK (description IS NULL OR char_length(description) <= 5000) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.listings ADD CONSTRAINT listings_place_len CHECK (char_length(coalesce(city, '')) <= 80 AND char_length(coalesce(province, '')) <= 80 AND char_length(coalesce(phone, '')) <= 25) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP POLICY IF EXISTS listings_select ON public.listings;
CREATE POLICY listings_select ON public.listings FOR SELECT USING (
  (status = 'active' AND blocked_at IS NULL AND public.seller_is_active(seller_id))
  OR auth.uid() = seller_id
  OR public.is_admin()
);

CREATE INDEX IF NOT EXISTS idx_listings_seller_created ON public.listings(seller_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.guard_listing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean := public.is_admin();
  v_img text;
  v_count int;
BEGIN
  -- Operaciones internas (p. ej. reponer stock al cancelar un pedido)
  IF current_setting('islamercado.skip_plan_check', true) = 'on' THEN RETURN NEW; END IF;
  IF v_uid IS NULL OR v_admin THEN RETURN NEW; END IF;

  IF public.is_banned(v_uid) THEN
    RAISE EXCEPTION 'Tu cuenta está suspendida. No puedes publicar ni modificar anuncios.' USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT count(*) INTO v_count FROM public.listings
      WHERE seller_id = NEW.seller_id AND created_at > now() - interval '24 hours';
    IF v_count >= 30 THEN
      RAISE EXCEPTION 'Has publicado demasiados anuncios hoy. Inténtalo de nuevo mañana.' USING ERRCODE = 'P0001';
    END IF;
    NEW.views := 0;
    NEW.created_at := now();
    NEW.blocked_at := NULL;
    NEW.blocked_reason := NULL;
  ELSE
    -- Campos que el vendedor no puede tocar
    NEW.seller_id := OLD.seller_id;
    NEW.created_at := OLD.created_at;
    NEW.blocked_at := OLD.blocked_at;
    NEW.blocked_reason := OLD.blocked_reason;
    IF coalesce(current_setting('islamercado.views_bump', true), '') <> 'on' THEN
      NEW.views := OLD.views;
    END IF;
  END IF;

  -- Las fotos deben estar en la carpeta del propio vendedor (evita enlazar imágenes externas)
  IF TG_OP = 'INSERT' OR NEW.images IS DISTINCT FROM OLD.images THEN
    FOREACH v_img IN ARRAY coalesce(NEW.images, '{}'::text[]) LOOP
      IF NOT (v_img LIKE NEW.seller_id::text || '/%'
              OR (TG_OP = 'UPDATE' AND v_img = ANY (coalesce(OLD.images, '{}'::text[])))) THEN
        RAISE EXCEPTION 'Las fotos deben subirse desde IslaMercado.' USING ERRCODE = 'P0001';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_a_guard_listing ON public.listings;
CREATE TRIGGER trg_a_guard_listing BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.guard_listing();

-- Las visitas solo se suman por estas funciones
CREATE OR REPLACE FUNCTION public.increment_listing_views(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('islamercado.views_bump', 'on', true);
  UPDATE public.listings SET views = views + 1 WHERE id = p_id AND seller_id IS DISTINCT FROM auth.uid();
  PERFORM set_config('islamercado.views_bump', 'off', true);
END; $$;
CREATE OR REPLACE FUNCTION public.incrementar_vista(listing uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.increment_listing_views(listing);
END; $$;

-- ---------------------------------------------------------------------------
-- 5. Mensajes: no se pueden editar, límite anti-spam
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_messages_sender_created ON public.messages(sender_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.guard_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF public.is_banned(NEW.sender_id) THEN
      RAISE EXCEPTION 'Tu cuenta está suspendida. No puedes enviar mensajes.' USING ERRCODE = 'P0001';
    END IF;
    SELECT count(*) INTO v_count FROM public.messages WHERE sender_id = NEW.sender_id AND created_at > now() - interval '1 minute';
    IF v_count >= 15 THEN
      RAISE EXCEPTION 'Estás enviando mensajes muy rápido. Espera un minuto.' USING ERRCODE = 'P0001';
    END IF;
    SELECT count(*) INTO v_count FROM public.messages WHERE sender_id = NEW.sender_id AND created_at > now() - interval '24 hours';
    IF v_count >= 300 THEN
      RAISE EXCEPTION 'Llegaste al límite diario de mensajes. Inténtalo mañana.' USING ERRCODE = 'P0001';
    END IF;
    NEW.read_at := NULL;
    NEW.created_at := now();
  ELSE
    -- El destinatario solo puede marcarlo como leído
    NEW.id := OLD.id;
    NEW.body := OLD.body;
    NEW.sender_id := OLD.sender_id;
    NEW.receiver_id := OLD.receiver_id;
    NEW.listing_id := OLD.listing_id;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_message ON public.messages;
CREATE TRIGGER trg_guard_message BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_message();

-- ---------------------------------------------------------------------------
-- 6. Preguntas: integridad y límites
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.questions ADD CONSTRAINT questions_question_len CHECK (char_length(question) BETWEEN 3 AND 500) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.questions ADD CONSTRAINT questions_answer_len CHECK (answer IS NULL OR char_length(answer) <= 1000) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_questions_asker_created ON public.questions(asker_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.guard_question()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF public.is_banned(NEW.asker_id) THEN
      RAISE EXCEPTION 'Tu cuenta está suspendida. No puedes hacer preguntas.' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.listings WHERE id = NEW.listing_id AND seller_id = NEW.asker_id) THEN
      RAISE EXCEPTION 'No puedes preguntar en tu propio anuncio.' USING ERRCODE = 'P0001';
    END IF;
    SELECT count(*) INTO v_count FROM public.questions WHERE asker_id = NEW.asker_id AND created_at > now() - interval '1 hour';
    IF v_count >= 10 THEN
      RAISE EXCEPTION 'Has hecho muchas preguntas en poco tiempo. Espera un rato.' USING ERRCODE = 'P0001';
    END IF;
    NEW.answer := NULL;
    NEW.answered_at := NULL;
    NEW.created_at := now();
  ELSE
    -- El vendedor solo puede responder; la pregunta no se puede alterar
    NEW.id := OLD.id;
    NEW.listing_id := OLD.listing_id;
    NEW.asker_id := OLD.asker_id;
    NEW.question := OLD.question;
    NEW.created_at := OLD.created_at;
    IF NEW.answer IS DISTINCT FROM OLD.answer THEN
      NEW.answered_at := CASE WHEN NEW.answer IS NULL THEN NULL ELSE now() END;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_question ON public.questions;
CREATE TRIGGER trg_guard_question BEFORE INSERT OR UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.guard_question();

-- ---------------------------------------------------------------------------
-- 7. Reseñas: solo compradores con un pedido entregado
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS reviews_insert_author ON public.reviews;
CREATE POLICY reviews_insert_author ON public.reviews FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = author_id AND author_id <> seller_id AND NOT public.is_banned(auth.uid())
  AND EXISTS (SELECT 1 FROM public.orders o WHERE o.buyer_id = auth.uid() AND o.seller_id = reviews.seller_id AND o.status = 'delivered')
);
DROP POLICY IF EXISTS reviews_update_author ON public.reviews;
CREATE POLICY reviews_update_author ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (
  auth.uid() = author_id AND author_id <> seller_id AND NOT public.is_banned(auth.uid())
  AND EXISTS (SELECT 1 FROM public.orders o WHERE o.buyer_id = auth.uid() AND o.seller_id = reviews.seller_id AND o.status = 'delivered')
);

-- ---------------------------------------------------------------------------
-- 8. Pedidos y suscripciones: cuentas suspendidas y límites
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_buyer_created ON public.orders(buyer_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.guard_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF public.is_banned(NEW.buyer_id) THEN
    RAISE EXCEPTION 'Tu cuenta está suspendida. No puedes hacer compras.' USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO v_count FROM public.orders WHERE buyer_id = NEW.buyer_id AND created_at > now() - interval '1 hour';
  IF v_count >= 30 THEN
    RAISE EXCEPTION 'Has hecho demasiados pedidos en poco tiempo. Espera un rato.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_order ON public.orders;
CREATE TRIGGER trg_guard_order BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_order();

CREATE OR REPLACE FUNCTION public.guard_subscription_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.payment_method <> 'admin' AND public.is_banned(NEW.user_id) THEN
    RAISE EXCEPTION 'Tu cuenta está suspendida. Contacta al administrador.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_subscription_request ON public.seller_subscriptions;
CREATE TRIGGER trg_guard_subscription_request BEFORE INSERT ON public.seller_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.guard_subscription_request();

-- ---------------------------------------------------------------------------
-- 9. Perfiles: nombres válidos y nombres reservados
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_reserved boolean;
BEGIN
  NEW.username := left(btrim(regexp_replace(coalesce(NEW.username, ''), '[<>"`]', '', 'g')), 40);
  NEW.phone := nullif(btrim(coalesce(NEW.phone, '')), '');
  v_reserved := NEW.username ~* '^(admin|administra|islamercado|isla_mercado|soporte|moderador|staff|oficial)';
  IF TG_OP = 'INSERT' THEN
    IF NEW.username = '' OR v_reserved THEN
      NEW.username := 'usuario_' || substr(replace(NEW.id::text, '-', ''), 1, 6);
    END IF;
  ELSE
    NEW.id := OLD.id;
    NEW.created_at := OLD.created_at;
    IF NEW.username = '' THEN
      RAISE EXCEPTION 'El nombre de usuario no puede estar vacío.' USING ERRCODE = 'P0001';
    END IF;
    IF v_reserved AND NEW.username IS DISTINCT FROM OLD.username AND NOT public.has_admin_role(NEW.id) THEN
      RAISE EXCEPTION 'Ese nombre de usuario está reservado. Elige otro.' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.phone IS NOT NULL AND NEW.phone !~ '^\+?[0-9 ()-]{6,20}$' THEN
      RAISE EXCEPTION 'El teléfono no es válido. Usa solo números, por ejemplo 53 5 1234567.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF NEW.avatar_url IS NOT NULL AND char_length(NEW.avatar_url) > 500 THEN
    NEW.avatar_url := NULL;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_profile ON public.profiles;
CREATE TRIGGER trg_guard_profile BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile();

-- ---------------------------------------------------------------------------
-- 10. Denuncias
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (reason IN ('estafa','prohibido','falso','spam','ofensivo','otro')),
  details text CHECK (details IS NULL OR char_length(details) <= 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  admin_note text,
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reporter_id <> reported_user_id)
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id, created_at DESC);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reports_select ON public.reports;
CREATE POLICY reports_select ON public.reports FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR public.is_admin());
REVOKE ALL ON public.reports FROM anon, authenticated;
GRANT SELECT ON public.reports TO authenticated;

CREATE OR REPLACE FUNCTION public.report_content(p_listing uuid, p_user uuid, p_reason text, p_details text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_target uuid := p_user; v_id uuid; v_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Inicia sesión para denunciar.'; END IF;
  IF p_listing IS NOT NULL THEN
    SELECT seller_id INTO v_target FROM public.listings WHERE id = p_listing;
    IF NOT FOUND THEN RAISE EXCEPTION 'Anuncio no encontrado.'; END IF;
  END IF;
  IF v_target IS NULL THEN RAISE EXCEPTION 'Indica qué quieres denunciar.'; END IF;
  IF v_target = v_uid THEN RAISE EXCEPTION 'No puedes denunciarte a ti mismo.'; END IF;
  IF p_reason NOT IN ('estafa','prohibido','falso','spam','ofensivo','otro') THEN RAISE EXCEPTION 'Motivo no válido.'; END IF;
  IF p_reason = 'otro' AND coalesce(btrim(p_details), '') = '' THEN RAISE EXCEPTION 'Cuéntanos brevemente qué pasó.'; END IF;
  SELECT count(*) INTO v_count FROM public.reports WHERE reporter_id = v_uid AND created_at > now() - interval '24 hours';
  IF v_count >= 10 THEN RAISE EXCEPTION 'Has enviado muchas denuncias hoy. Inténtalo mañana.'; END IF;
  IF EXISTS (SELECT 1 FROM public.reports WHERE reporter_id = v_uid AND status = 'open'
             AND reported_user_id = v_target AND listing_id IS NOT DISTINCT FROM p_listing) THEN
    RAISE EXCEPTION 'Ya enviaste esta denuncia. La estamos revisando.';
  END IF;
  INSERT INTO public.reports (reporter_id, reported_user_id, listing_id, reason, details)
  VALUES (v_uid, v_target, p_listing, p_reason, nullif(left(btrim(coalesce(p_details, '')), 1000), ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- ---------------------------------------------------------------------------
-- 11. Funciones de moderación del administrador
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_ban_user(p_user uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo el administrador.'; END IF;
  IF public.has_admin_role(p_user) THEN RAISE EXCEPTION 'No puedes suspender a un administrador.'; END IF;
  IF coalesce(btrim(p_reason), '') = '' OR char_length(btrim(p_reason)) < 3 THEN RAISE EXCEPTION 'Indica el motivo de la suspensión.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user) THEN RAISE EXCEPTION 'Usuario no encontrado.'; END IF;
  INSERT INTO public.user_bans (user_id, reason, banned_by) VALUES (p_user, left(btrim(p_reason), 500), auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET reason = EXCLUDED.reason, banned_by = EXCLUDED.banned_by, created_at = now();
  -- Impide también iniciar sesión (las sesiones abiertas caducan en < 1 h; la BD ya bloquea todo)
  UPDATE auth.users SET banned_until = now() + interval '100 years' WHERE id = p_user;
  -- Cancela solicitudes de plan pendientes
  UPDATE public.seller_subscriptions SET status = 'cancelled', admin_note = 'Cuenta suspendida', reviewed_at = now()
    WHERE user_id = p_user AND status = 'pending';
  PERFORM public._audit('user_banned', 'user', p_user::text, jsonb_build_object('reason', btrim(p_reason)));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_unban_user(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo el administrador.'; END IF;
  DELETE FROM public.user_bans WHERE user_id = p_user;
  UPDATE auth.users SET banned_until = NULL WHERE id = p_user;
  PERFORM public._audit('user_unbanned', 'user', p_user::text, '{}');
END; $$;

CREATE OR REPLACE FUNCTION public.admin_block_listing(p_listing uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_title text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo el administrador.'; END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN RAISE EXCEPTION 'Indica el motivo del bloqueo.'; END IF;
  UPDATE public.listings SET blocked_at = now(), blocked_reason = left(btrim(p_reason), 300), featured = false
    WHERE id = p_listing RETURNING title INTO v_title;
  IF NOT FOUND THEN RAISE EXCEPTION 'Anuncio no encontrado.'; END IF;
  PERFORM public._audit('listing_blocked', 'listing', p_listing::text, jsonb_build_object('title', v_title, 'reason', btrim(p_reason)));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_unblock_listing(p_listing uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_title text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo el administrador.'; END IF;
  UPDATE public.listings SET blocked_at = NULL, blocked_reason = NULL WHERE id = p_listing RETURNING title INTO v_title;
  IF NOT FOUND THEN RAISE EXCEPTION 'Anuncio no encontrado.'; END IF;
  PERFORM public._audit('listing_unblocked', 'listing', p_listing::text, jsonb_build_object('title', v_title));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_report(p_id uuid, p_status text, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo el administrador.'; END IF;
  IF p_status NOT IN ('resolved','dismissed','open') THEN RAISE EXCEPTION 'Estado no válido.'; END IF;
  UPDATE public.reports SET status = p_status, admin_note = nullif(btrim(coalesce(p_note, '')), ''),
    resolved_by = CASE WHEN p_status = 'open' THEN NULL ELSE auth.uid() END,
    resolved_at = CASE WHEN p_status = 'open' THEN NULL ELSE now() END
  WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Denuncia no encontrada.'; END IF;
  PERFORM public._audit('report_' || p_status, 'report', p_id::text, jsonb_build_object('note', p_note));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_reports(p_status text DEFAULT 'open')
RETURNS TABLE (id uuid, created_at timestamptz, reason text, details text, status text, admin_note text, resolved_at timestamptz,
  reporter_id uuid, reporter_username text, reported_user_id uuid, reported_username text, reported_banned boolean,
  listing_id uuid, listing_title text, listing_blocked boolean, open_against_user bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo el administrador.'; END IF;
  RETURN QUERY
  SELECT r.id, r.created_at, r.reason, r.details, r.status, r.admin_note, r.resolved_at,
    r.reporter_id, rp.username, r.reported_user_id, tp.username, public.is_banned(r.reported_user_id),
    r.listing_id, l.title, (l.blocked_at IS NOT NULL),
    (SELECT count(*) FROM public.reports x WHERE x.reported_user_id = r.reported_user_id AND x.status = 'open')
  FROM public.reports r
  JOIN public.profiles rp ON rp.id = r.reporter_id
  JOIN public.profiles tp ON tp.id = r.reported_user_id
  LEFT JOIN public.listings l ON l.id = r.listing_id
  WHERE p_status IS NULL OR r.status = p_status
  ORDER BY r.created_at DESC
  LIMIT 300;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_users(p_q text DEFAULT NULL)
RETURNS TABLE (id uuid, username text, email text, phone text, created_at timestamptz, email_confirmed boolean,
  last_sign_in_at timestamptz, plan_id text, active_listings bigint, open_reports bigint, banned boolean, ban_reason text, is_admin boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo el administrador.'; END IF;
  RETURN QUERY
  SELECT p.id, p.username, u.email::text, p.phone, p.created_at, (u.email_confirmed_at IS NOT NULL), u.last_sign_in_at,
    public.active_plan_id(p.id),
    (SELECT count(*) FROM public.listings l WHERE l.seller_id = p.id AND l.status = 'active'),
    (SELECT count(*) FROM public.reports r WHERE r.reported_user_id = p.id AND r.status = 'open'),
    (b.user_id IS NOT NULL), b.reason, public.has_admin_role(p.id)
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.user_bans b ON b.user_id = p.id
  WHERE coalesce(btrim(p_q), '') = '' OR p.username ILIKE '%' || p_q || '%' OR u.email ILIKE '%' || p_q || '%'
  ORDER BY (SELECT count(*) FROM public.reports r WHERE r.reported_user_id = p.id AND r.status = 'open') DESC, p.created_at DESC
  LIMIT 100;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_list_audit(p_limit int DEFAULT 100)
RETURNS TABLE (id bigint, created_at timestamptz, admin_username text, action text, target_type text, target_id text, details jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo el administrador.'; END IF;
  RETURN QUERY
  SELECT a.id, a.created_at, p.username, a.action, a.target_type, a.target_id, a.details
  FROM public.admin_audit a LEFT JOIN public.profiles p ON p.id = a.admin_id
  ORDER BY a.created_at DESC
  LIMIT least(greatest(coalesce(p_limit, 100), 1), 500);
END; $$;

-- ---------------------------------------------------------------------------
-- 12. Estado del usuario actual (añade rol de admin, 2 pasos y suspensión)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_seller_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_sub public.seller_subscriptions%ROWTYPE; v_pending public.seller_subscriptions%ROWTYPE;
  v_last public.seller_subscriptions%ROWTYPE; v_ban public.user_bans%ROWTYPE; v_admin boolean;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('is_admin', false, 'admin_role', false); END IF;
  v_admin := public.is_admin(v_uid);
  SELECT * INTO v_sub FROM public.seller_subscriptions
    WHERE user_id = v_uid AND status = 'active' AND now() >= starts_at AND now() < expires_at
    ORDER BY expires_at DESC LIMIT 1;
  SELECT * INTO v_pending FROM public.seller_subscriptions WHERE user_id = v_uid AND status = 'pending' LIMIT 1;
  SELECT * INTO v_last FROM public.seller_subscriptions WHERE user_id = v_uid ORDER BY coalesce(reviewed_at, created_at) DESC LIMIT 1;
  SELECT * INTO v_ban FROM public.user_bans WHERE user_id = v_uid;
  RETURN jsonb_build_object(
    'is_admin', v_admin,
    'admin_role', public.has_admin_role(v_uid),
    'mfa_enrolled', EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = v_uid AND f.status = 'verified'),
    'banned', CASE WHEN v_ban.user_id IS NULL THEN NULL ELSE jsonb_build_object('reason', v_ban.reason, 'since', v_ban.created_at) END,
    'subscription', CASE WHEN v_sub.id IS NULL THEN NULL ELSE to_jsonb(v_sub) END,
    'pending', CASE WHEN v_pending.id IS NULL THEN NULL ELSE to_jsonb(v_pending) END,
    'last', CASE WHEN v_last.id IS NULL THEN NULL ELSE to_jsonb(v_last) END,
    'active_listings', (SELECT count(*) FROM public.listings WHERE seller_id = v_uid AND status = 'active'),
    'featured_listings', (SELECT count(*) FROM public.listings WHERE seller_id = v_uid AND status = 'active' AND featured),
    'blocked_listings', (SELECT count(*) FROM public.listings WHERE seller_id = v_uid AND blocked_at IS NOT NULL),
    'pending_reviews', CASE WHEN v_admin THEN (SELECT count(*) FROM public.seller_subscriptions WHERE status = 'pending') ELSE 0 END,
    'open_reports', CASE WHEN v_admin THEN (SELECT count(*) FROM public.reports WHERE status = 'open') ELSE 0 END
  );
END; $$;

-- ---------------------------------------------------------------------------
-- 13. Almacenamiento: solo imágenes, máx. 8 MB
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
  SET file_size_limit = 8388608, allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif']
  WHERE id = 'listing-images';

-- ---------------------------------------------------------------------------
-- 14. Permisos de funciones
-- ---------------------------------------------------------------------------
-- Funciones de trigger: nadie debe poder llamarlas directamente
REVOKE ALL ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_seller_plan() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_listing() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_message() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_question() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_order() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_subscription_request() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_profile() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_subscription_change() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_config_change() FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_admin_role(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_banned(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seller_is_active(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_listing_views(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.incrementar_vista(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.report_content(uuid, uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.report_content(uuid, uuid, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_ban_user(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_unban_user(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_unban_user(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_block_listing(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_block_listing(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_unblock_listing(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_unblock_listing(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_resolve_report(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_reports(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_reports(text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_users(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_audit(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_audit(int) TO authenticated;
REVOKE ALL ON FUNCTION public.my_seller_status() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_seller_status() TO authenticated;
