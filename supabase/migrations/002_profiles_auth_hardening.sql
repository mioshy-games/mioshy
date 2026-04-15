-- Profiles on signup, tighten insert policy, prevent non-admin role escalation

-- ---------------------------------------------------------------------------
-- Auto-create profile row for new auth users
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing auth users missing a profile row
INSERT INTO public.profiles (id, role)
SELECT u.id, 'user'
FROM auth.users AS u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles AS p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Only self-service inserts as role 'user' (trigger covers normal signup)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id AND role = 'user');

-- ---------------------------------------------------------------------------
-- Block role changes except by admins or privileged (Studio / no JWT) paths
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profiles_enforce_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF auth.uid() IS NULL THEN
      RETURN NEW;
    END IF;
    IF public.is_admin() THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot change role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_enforce_role_change ON public.profiles;
CREATE TRIGGER profiles_enforce_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_enforce_role_change();
