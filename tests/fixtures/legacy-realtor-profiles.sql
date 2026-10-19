-- Read-only production inspection, 2026-10-19. auth.users/roles supplied by tests.
CREATE TABLE public.realtor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  full_name text, email text, phone text, bio text, headshot_url text, video_url text,
  plan text DEFAULT 'free', page_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.realtor_profiles ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.realtor_profiles TO anon, authenticated, service_role;
CREATE POLICY "Public can view realtor profiles" ON public.realtor_profiles FOR SELECT USING (true);
CREATE POLICY "Users can create their own profile" ON public.realtor_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.realtor_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
