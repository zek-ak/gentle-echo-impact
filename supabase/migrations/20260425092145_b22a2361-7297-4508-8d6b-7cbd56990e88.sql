BEGIN;

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  target_amount NUMERIC NOT NULL CHECK (target_amount >= 0),
  collected_amount NUMERIC NOT NULL DEFAULT 0 CHECK (collected_amount >= 0),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'ongoing' CHECK (status IN ('ongoing','completed','paused','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Projects publicly viewable" ON public.projects;
CREATE POLICY "Projects publicly viewable" ON public.projects FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can create project" ON public.projects;
CREATE POLICY "Anyone can create project" ON public.projects FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update project" ON public.projects;
CREATE POLICY "Anyone can update project" ON public.projects FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);

DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  method TEXT DEFAULT 'mobile_money' CHECK (method IN ('mobile_money','bank_transfer','cash','check','other')),
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public select contributions" ON public.contributions;
CREATE POLICY "Public select contributions" ON public.contributions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public insert contributions" ON public.contributions;
CREATE POLICY "Public insert contributions" ON public.contributions FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_contributions_user_id ON public.contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_project_id ON public.contributions(project_id);
CREATE INDEX IF NOT EXISTS idx_contributions_created_at ON public.contributions(created_at);

DROP TRIGGER IF EXISTS update_contributions_updated_at ON public.contributions;
CREATE TRIGGER update_contributions_updated_at
  BEFORE UPDATE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.update_project_collected_amount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.projects
  SET collected_amount = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.contributions
    WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)
  )
  WHERE id = COALESCE(NEW.project_id, OLD.project_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_project_collected_on_contribution ON public.contributions;
CREATE TRIGGER update_project_collected_on_contribution
  AFTER INSERT OR UPDATE OR DELETE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.update_project_collected_amount();

CREATE TABLE IF NOT EXISTS public.pledges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  pledge_amount NUMERIC NOT NULL CHECK (pledge_amount >= 0),
  year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pledges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public create pledges" ON public.pledges;
CREATE POLICY "Public create pledges" ON public.pledges FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public update pledges" ON public.pledges;
CREATE POLICY "Public update pledges" ON public.pledges FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public select pledges" ON public.pledges;
CREATE POLICY "Public select pledges" ON public.pledges FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_pledges_user_id ON public.pledges(user_id);
CREATE INDEX IF NOT EXISTS idx_pledges_year ON public.pledges(year);

DROP TRIGGER IF EXISTS update_pledges_updated_at ON public.pledges;
CREATE TRIGGER update_pledges_updated_at
  BEFORE UPDATE ON public.pledges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.badges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id TEXT REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view badges" ON public.badges;
CREATE POLICY "Anyone can view badges" ON public.badges FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public select user_badges" ON public.user_badges;
CREATE POLICY "Public select user_badges" ON public.user_badges FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public insert user_badges" ON public.user_badges;
CREATE POLICY "Public insert user_badges" ON public.user_badges FOR INSERT WITH CHECK (true);

INSERT INTO public.badges (id, name, description, icon) VALUES
  ('first', 'First Step', 'Made your first contribution', 'sparkle'),
  ('streak_7', '7-Day Streak', 'Contributed 7 days in a row', 'flame'),
  ('streak_30', '30-Day Streak', 'Contributed 30 days in a row', 'trophy'),
  ('milestone_100k', '100K Club', 'Contributed over 100,000 TZS', 'medal'),
  ('milestone_500k', '500K Club', 'Contributed over 500,000 TZS', 'crown')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_public_dashboard()
RETURNS jsonb AS $$
DECLARE
  total_collected NUMERIC := 0;
  active_members INT := 0;
  current_project JSONB;
BEGIN
  SELECT
    COALESCE(SUM(amount), 0),
    COUNT(DISTINCT user_id)
  INTO total_collected, active_members
  FROM public.contributions;

  SELECT jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'description', p.description,
    'target_amount', p.target_amount,
    'collected_amount', COALESCE(SUM(c.amount), 0),
    'status', p.status
  )
  INTO current_project
  FROM public.projects p
  LEFT JOIN public.contributions c ON c.project_id = p.id
  WHERE p.status = 'ongoing'
  GROUP BY p.id, p.name, p.description, p.target_amount, p.status
  ORDER BY p.created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'total_collected', total_collected,
    'active_members', active_members,
    'current_project', COALESCE(current_project, '{}'::jsonb),
    'best_group', NULL,
    'groups_leaderboard', NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_public_dashboard() TO anon, authenticated;

COMMIT;