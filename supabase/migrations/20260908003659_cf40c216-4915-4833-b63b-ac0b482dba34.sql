-- ============ papéis ============
CREATE TYPE public.app_role AS ENUM ('admin','curator','author','vip','reader');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  suspended boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.staff_emails (
  email text PRIMARY KEY,
  role public.app_role NOT NULL
);
GRANT ALL ON public.staff_emails TO service_role;
ALTER TABLE public.staff_emails ENABLE ROW LEVEL SECURITY;
INSERT INTO public.staff_emails (email, role) VALUES
  ('denis@thebeyond.art','admin'),
  ('curadoria@thebeyond.art','curator');

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','curator')
  )
$$;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- ============ bootstrap de conta ============
CREATE OR REPLACE FUNCTION public.bootstrap_profile(p_name text DEFAULT NULL)
RETURNS public.app_role LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email',''));
  v_role public.app_role;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  INSERT INTO public.profiles (id, name, email)
  VALUES (v_uid, coalesce(nullif(trim(coalesce(p_name,'')),''), split_part(v_email,'@',1)), v_email)
  ON CONFLICT (id) DO UPDATE
    SET name = CASE WHEN nullif(trim(coalesce(p_name,'')),'') IS NOT NULL
                    THEN trim(p_name) ELSE public.profiles.name END,
        email = v_email;

  SELECT s.role INTO v_role FROM public.staff_emails s WHERE lower(s.email) = v_email;
  IF v_role IS NULL THEN v_role := 'reader'; END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF v_role = 'admin' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'curator')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN v_role;
END;
$$;
GRANT EXECUTE ON FUNCTION public.bootstrap_profile(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_user_role(p_user_id uuid, p_role public.app_role, p_replace boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_replace THEN DELETE FROM public.user_roles WHERE user_id = p_user_id; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (p_user_id, p_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role, boolean) TO authenticated;

-- ============ candidaturas de autor ============
CREATE TABLE public.author_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  artist_name text NOT NULL,
  email text NOT NULL,
  field text NOT NULL DEFAULT 'Outro',
  bio text NOT NULL DEFAULT '',
  portfolio text NOT NULL DEFAULT '',
  samples integer NOT NULL DEFAULT 0,
  message text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','changes')),
  curator_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.author_applications TO authenticated;
GRANT INSERT ON public.author_applications TO anon;
GRANT ALL ON public.author_applications TO service_role;
ALTER TABLE public.author_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apps_insert_anon" ON public.author_applications FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);
CREATE POLICY "apps_insert_auth" ON public.author_applications FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "apps_select" ON public.author_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "apps_update_staff" ON public.author_applications FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- promove o candidato aprovado a autor
CREATE OR REPLACE FUNCTION public.decide_application(p_id uuid, p_status text, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
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
GRANT EXECUTE ON FUNCTION public.decide_application(uuid, text, text) TO authenticated;

-- ============ obras ============
CREATE TABLE public.works (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  medium text NOT NULL DEFAULT 'visual'
    CHECK (medium IN ('visual','writing','music','illustration')),
  artist_name text NOT NULL DEFAULT '',
  artist_slug text NOT NULL DEFAULT '',
  author_id uuid,
  excerpt text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  cover_url text,
  tags text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','changes','draft')),
  curator_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.works TO authenticated;
GRANT SELECT ON public.works TO anon;
GRANT ALL ON public.works TO service_role;
ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;

CREATE POLICY "works_select_public" ON public.works FOR SELECT TO anon, authenticated
  USING (status = 'approved');
CREATE POLICY "works_select_own" ON public.works FOR SELECT TO authenticated
  USING (author_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "works_insert_own" ON public.works FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());
CREATE POLICY "works_update_own" ON public.works FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "works_update_staff" ON public.works FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.decide_work(p_id uuid, p_status text, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
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
GRANT EXECUTE ON FUNCTION public.decide_work(uuid, text, text) TO authenticated;

-- ============ visualizações reais ============
CREATE TABLE public.work_views (
  work_slug text PRIMARY KEY,
  views bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.work_views TO anon, authenticated;
GRANT ALL ON public.work_views TO service_role;
ALTER TABLE public.work_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "views_select_public" ON public.work_views FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.register_work_view(p_slug text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v bigint;
BEGIN
  IF p_slug IS NULL OR length(trim(p_slug)) = 0 THEN RAISE EXCEPTION 'invalid slug'; END IF;
  INSERT INTO public.work_views (work_slug, views) VALUES (trim(p_slug), 1)
  ON CONFLICT (work_slug) DO UPDATE
    SET views = public.work_views.views + 1, updated_at = now()
  RETURNING views INTO v;
  RETURN v;
END;
$$;
GRANT EXECUTE ON FUNCTION public.register_work_view(text) TO anon, authenticated;

-- ============ doações reais ============
CREATE TABLE public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_slug text NOT NULL,
  artist_slug text NOT NULL DEFAULT '',
  artist_name text NOT NULL DEFAULT '',
  donor_id uuid,
  donor_name text NOT NULL DEFAULT 'Anônimo',
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.donations TO authenticated;
GRANT INSERT ON public.donations TO anon;
GRANT ALL ON public.donations TO service_role;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "donations_insert_anon" ON public.donations FOR INSERT TO anon
  WITH CHECK (donor_id IS NULL);
CREATE POLICY "donations_insert_auth" ON public.donations FOR INSERT TO authenticated
  WITH CHECK (donor_id IS NULL OR donor_id = auth.uid());
CREATE POLICY "donations_select" ON public.donations FOR SELECT TO authenticated
  USING (donor_id = auth.uid() OR public.is_staff(auth.uid()));

-- totais públicos de doação por obra (sem expor quem doou)
CREATE OR REPLACE FUNCTION public.donation_totals()
RETURNS TABLE (work_slug text, total numeric, supporters bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.work_slug, sum(d.amount)::numeric, count(*)::bigint
  FROM public.donations d GROUP BY d.work_slug
$$;
GRANT EXECUTE ON FUNCTION public.donation_totals() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.platform_totals()
RETURNS TABLE (total_views bigint, total_donations numeric, donation_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    coalesce((SELECT sum(views) FROM public.work_views),0)::bigint,
    coalesce((SELECT sum(amount) FROM public.donations),0)::numeric,
    coalesce((SELECT count(*) FROM public.donations),0)::bigint
$$;
GRANT EXECUTE ON FUNCTION public.platform_totals() TO anon, authenticated;

-- ============ conteúdo inicial ============
INSERT INTO public.work_views (work_slug, views) VALUES
  ('gilded-silence', 18420),
  ('before-the-city-wakes', 9310),
  ('a-quiet-taxonomy', 22105),
  ('tape-loop-no-4', 6740),
  ('on-looking-longer', 31480),
  ('field-notes-on-yellow', 12060);

INSERT INTO public.donations (work_slug, artist_slug, artist_name, donor_name, amount) VALUES
  ('gilded-silence','mira-okonkwo','Mira Okonkwo','A. Ferreira',120),
  ('gilded-silence','mira-okonkwo','Mira Okonkwo','R. Silva',90),
  ('gilded-silence','mira-okonkwo','Mira Okonkwo','Anônimo',100),
  ('before-the-city-wakes','tomas-reyes','Tomás Reyes','M. Lindqvist',45),
  ('before-the-city-wakes','tomas-reyes','Tomás Reyes','Anônimo',100),
  ('a-quiet-taxonomy','ines-halvorsen','Inés Halvorsen','A. Ferreira',220),
  ('a-quiet-taxonomy','ines-halvorsen','Inés Halvorsen','R. Silva',300),
  ('a-quiet-taxonomy','ines-halvorsen','Inés Halvorsen','J. Okafor',100),
  ('tape-loop-no-4','kaveh-noor','Kaveh Noor','Anônimo',95),
  ('on-looking-longer','ines-halvorsen','Inés Halvorsen','L. Beaumont',180),
  ('on-looking-longer','ines-halvorsen','Inés Halvorsen','A. Ferreira',300),
  ('field-notes-on-yellow','mira-okonkwo','Mira Okonkwo','M. Lindqvist',130);

INSERT INTO public.author_applications (artist_name, email, field, bio, portfolio, samples, message, status, created_at) VALUES
  ('Helena Vaz','helena@vaz.art','Arte Visual','Pinturas em têmpera sobre madeira recuperada. Trabalho em série, sempre em pares.','https://helenavaz.art',3,'Tenho uma série de nove peças pronta para publicar mensalmente.','pending','2026-08-24T10:00:00Z'),
  ('Nuno Aragão','nuno@ateliearagao.pt','Ilustração','Nanquim e guache. Ilustro arquiteturas imaginadas de cidades que não existem.','https://aragao.ink',2,NULL,'pending','2026-08-26T10:00:00Z'),
  ('Clara Bittencourt','clara.b@mail.com','Escrita','Ensaios curtos sobre memória e cidade. Publico há seis anos em revistas independentes.','https://clarabittencourt.substack.com',1,'Posso enviar um ensaio inédito para leitura da curadoria.','pending','2026-08-29T10:00:00Z'),
  ('Sofia Meireles','sofia@meireles.fm','Música','Peças para piano preparado e campo gravado. Uma faixa por estação do ano.','https://meireles.fm',3,NULL,'pending','2026-08-30T10:00:00Z');

INSERT INTO public.works (slug, title, medium, artist_name, artist_slug, excerpt, body, status, curator_note, created_at) VALUES
  ('estudo-de-erosao-7','Estudo de Erosão nº 7','visual','Mira Okonkwo','mira-okonkwo','Óleo sobre linho, 90 × 70 cm. Sétimo estudo de uma série sobre desgaste.','A camada de baixo levou três semanas a secar. O que se vê é o que sobrou dela.','pending',NULL,'2026-08-27T10:00:00Z'),
  ('cadernos-de-inverno','Cadernos de Inverno','writing','Inés Halvorsen','ines-halvorsen','Seis fragmentos escritos entre dezembro e fevereiro, sobre a atenção no frio.','O inverno reduz o mundo a poucas coisas, e é por isso que se olha melhor.','pending',NULL,'2026-08-28T10:00:00Z'),
  ('drone-para-sala-vazia','Drone para Sala Vazia','music','Kaveh Noor','kaveh-noor','Quatorze minutos gravados numa sala sem mobília, com um único acorde sustentado.','A sala tem 1,8 segundos de reverberação. Ela é o segundo instrumento.','pending',NULL,'2026-08-30T10:00:00Z'),
  ('reforma-5h12','Reforma, 5h12','visual','Tomás Reyes','tomas-reyes','35 mm, papel de fibra. A avenida antes do primeiro autocarro.','Esperei quarenta minutos por um enquadramento em que ninguém atravessasse.','changes','Enviar versão sem recorte na margem esquerda.','2026-08-31T10:00:00Z');