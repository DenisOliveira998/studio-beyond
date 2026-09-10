CREATE POLICY "donations_select_author" ON public.donations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.works w
    WHERE w.slug = donations.work_slug AND w.author_id = auth.uid()
  ));