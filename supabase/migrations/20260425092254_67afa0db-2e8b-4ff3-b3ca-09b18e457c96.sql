CREATE TABLE IF NOT EXISTS public.church_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL UNIQUE,
  annual_goal NUMERIC NOT NULL DEFAULT 0,
  best_group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.church_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Church settings publicly viewable" ON public.church_settings;
CREATE POLICY "Church settings publicly viewable" ON public.church_settings FOR SELECT USING (true);

DROP TRIGGER IF EXISTS trg_church_settings_updated_at ON public.church_settings;
CREATE TRIGGER trg_church_settings_updated_at
  BEFORE UPDATE ON public.church_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP POLICY IF EXISTS "Anyone can create project" ON public.projects;
DROP POLICY IF EXISTS "Anyone can update project" ON public.projects;
DROP POLICY IF EXISTS "Projects publicly viewable" ON public.projects;

CREATE POLICY "Projects viewable by everyone" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Admins can create projects" ON public.projects FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Admins can update projects" ON public.projects FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Admins can delete projects" ON public.projects FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Roles publicly viewable" ON public.user_roles FOR SELECT USING (true);

ALTER TABLE public.contributions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS clickpesa_order_reference text,
  ADD COLUMN IF NOT EXISTS payment_provider text DEFAULT 'clickpesa',
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'TZS';

CREATE INDEX IF NOT EXISTS idx_contributions_order_reference ON public.contributions(clickpesa_order_reference);
CREATE INDEX IF NOT EXISTS idx_contributions_status ON public.contributions(status);

DROP POLICY IF EXISTS "Public update contributions status" ON public.contributions;
CREATE POLICY "Public update contributions status" ON public.contributions FOR UPDATE USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_project_collected_amount()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.projects
  SET collected_amount = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.contributions
    WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)
      AND status = 'completed'
  )
  WHERE id = COALESCE(NEW.project_id, OLD.project_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_profile_total_contributed()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.profiles
  SET total_contributed = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.contributions
    WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
      AND status = 'completed'
  )
  WHERE id = COALESCE(NEW.user_id, OLD.user_id);
  RETURN NEW;
END;
$$;

UPDATE public.profiles p SET total_contributed = COALESCE((
  SELECT SUM(amount) FROM public.contributions c
  WHERE c.user_id = p.id AND c.status = 'completed'
), 0);

UPDATE public.projects pr SET collected_amount = COALESCE((
  SELECT SUM(amount) FROM public.contributions c
  WHERE c.project_id = pr.id AND c.status = 'completed'
), 0);

ALTER TABLE public.church_settings
  ADD COLUMN IF NOT EXISTS best_group_name text,
  ADD COLUMN IF NOT EXISTS best_group_percentage numeric;

DROP POLICY IF EXISTS "Public can insert church settings" ON public.church_settings;
DROP POLICY IF EXISTS "Public can update church settings" ON public.church_settings;
CREATE POLICY "Public can insert church settings" ON public.church_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update church settings" ON public.church_settings FOR UPDATE USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.get_public_dashboard()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  total_collected NUMERIC := 0;
  active_members INT := 0;
  current_project JSONB;
  best_group_data JSONB;
  annual_goal_amount NUMERIC := 0;
  best_name TEXT;
  best_pct NUMERIC;
  current_year INT := EXTRACT(YEAR FROM now())::INT;
BEGIN
  SELECT COALESCE(SUM(amount), 0), COUNT(DISTINCT user_id)
    INTO total_collected, active_members
  FROM public.contributions
  WHERE status = 'completed';

  SELECT cs.annual_goal, cs.best_group_name, cs.best_group_percentage
    INTO annual_goal_amount, best_name, best_pct
  FROM public.church_settings cs
  WHERE cs.year = current_year LIMIT 1;

  IF best_name IS NOT NULL AND length(trim(best_name)) > 0 THEN
    best_group_data := jsonb_build_object(
      'name', best_name,
      'percentage', COALESCE(best_pct, 0)
    );
  END IF;

  SELECT jsonb_build_object(
    'id', p.id, 'name', p.name, 'description', p.description,
    'target_amount', p.target_amount, 'collected_amount', p.collected_amount,
    'status', p.status
  )
  INTO current_project
  FROM public.projects p
  WHERE p.status = 'ongoing'
  ORDER BY p.created_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'total_collected', total_collected,
    'active_members', active_members,
    'annual_goal', COALESCE(annual_goal_amount, 0),
    'current_project', COALESCE(current_project, '{}'::jsonb),
    'best_group', COALESCE(best_group_data, NULL),
    'groups_leaderboard', NULL
  );
END;
$$;