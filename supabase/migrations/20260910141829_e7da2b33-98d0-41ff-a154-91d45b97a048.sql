CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','curator')
  )
$$;

REVOKE EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.is_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_staff(uuid) TO authenticated, service_role;

-- recria as políticas usando as funções internas
DROP POLICY "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR private.is_staff(auth.uid()));
DROP POLICY "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

DROP POLICY "roles_select" ON public.user_roles;
CREATE POLICY "roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_staff(auth.uid()));

DROP POLICY "apps_select" ON public.author_applications;
CREATE POLICY "apps_select" ON public.author_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.is_staff(auth.uid()));
DROP POLICY "apps_update_staff" ON public.author_applications;
CREATE POLICY "apps_update_staff" ON public.author_applications FOR UPDATE TO authenticated
  USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

DROP POLICY "works_select_own" ON public.works;
CREATE POLICY "works_select_own" ON public.works FOR SELECT TO authenticated
  USING (author_id = auth.uid() OR private.is_staff(auth.uid()));
DROP POLICY "works_update_staff" ON public.works;
CREATE POLICY "works_update_staff" ON public.works FOR UPDATE TO authenticated
  USING (private.is_staff(auth.uid())) WITH CHECK (private.is_staff(auth.uid()));

DROP POLICY "donations_select" ON public.donations;
CREATE POLICY "donations_select" ON public.donations FOR SELECT TO authenticated
  USING (donor_id = auth.uid() OR private.is_staff(auth.uid()));

-- funções de decisão passam a usar as verificações internas
CREATE OR REPLACE FUNCTION public.decide_application(p_id uuid, p_status text, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid;
BEGIN
  IF NOT private.is_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_status NOT IN ('pending','approved','rejected','changes') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  UPDATE public.author_applications
     SET status = p_status, curator_note = p_note, decided_at = now()
   WHERE id = p_id
  RETURNING user_id INTO v_user;
  IF p_status = 'approved' AND v_user IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_user, 'author')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_work(p_id uuid, p_status text, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.is_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_status NOT IN ('pending','approved','rejected','changes') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  UPDATE public.works
     SET status = p_status,
         curator_note = p_note,
         published_at = CASE WHEN p_status = 'approved' THEN now() ELSE published_at END
   WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_role(p_user_id uuid, p_role public.app_role, p_replace boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_replace THEN DELETE FROM public.user_roles WHERE user_id = p_user_id; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (p_user_id, p_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_staff(uuid);