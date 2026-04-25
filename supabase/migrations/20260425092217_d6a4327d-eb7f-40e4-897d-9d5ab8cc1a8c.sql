BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS annual_goal NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_contributed NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'Seed Sower',
  ADD COLUMN IF NOT EXISTS group_id UUID;

UPDATE public.profiles
SET annual_goal = COALESCE(annual_goal, 0),
    total_contributed = COALESCE(total_contributed, 0),
    level = COALESCE(NULLIF(level, ''), 'Seed Sower');

CREATE TABLE IF NOT EXISTS public.groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  leader_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'groups_leader_id_fkey') THEN
    ALTER TABLE public.groups
      ADD CONSTRAINT groups_leader_id_fkey
      FOREIGN KEY (leader_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_group_id_fkey') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_group_id_fkey
      FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_group_id ON public.profiles(group_id);
CREATE INDEX IF NOT EXISTS idx_groups_leader_id ON public.groups(leader_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'finance_admin', 'group_leader', 'member');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  assigned_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_fkey') THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_assigned_by_fkey') THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_assigned_by_fkey
      FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.update_profile_total_contributed()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET total_contributed = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.contributions
    WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
  )
  WHERE id = COALESCE(NEW.user_id, OLD.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_profile_total_on_contribution ON public.contributions;
CREATE TRIGGER update_profile_total_on_contribution
  AFTER INSERT OR UPDATE OR DELETE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.update_profile_total_contributed();

CREATE OR REPLACE FUNCTION public.get_current_user_group_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT group_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
$$;

DROP POLICY IF EXISTS "Groups publicly viewable" ON public.groups;
CREATE POLICY "Groups publicly viewable" ON public.groups FOR SELECT USING (true);

DROP POLICY IF EXISTS "Group leaders can manage own group" ON public.groups;
CREATE POLICY "Group leaders can manage own group" ON public.groups FOR ALL
  USING (leader_id = auth.uid()) WITH CHECK (leader_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Profiles publicly viewable" ON public.profiles;
CREATE POLICY "Profiles publicly viewable" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Profiles publicly creatable" ON public.profiles;
CREATE POLICY "Profiles publicly creatable" ON public.profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Profiles publicly updatable" ON public.profiles;
CREATE POLICY "Profiles publicly updatable" ON public.profiles FOR UPDATE USING (true) WITH CHECK (true);

COMMIT;