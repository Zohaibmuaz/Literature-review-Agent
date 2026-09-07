-- ==============================================================================
-- SUPABASE SQL MIGRATION: PERMANENT CREDIT PERSISTENCE & 1-CREDIT INITIAL GRANT
-- Run this in your Supabase Project -> SQL Editor
-- ==============================================================================

-- 1. Ensure profiles table exists
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  credits_balance INTEGER DEFAULT 1 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add any missing columns in case profiles table was created earlier without them
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credits_balance INTEGER DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- 5. Create RLS policies so authenticated users can read, insert, and update their own record
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 6. Trigger Function: Automatically give 1 free credit to new users on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, credits_balance, updated_at)
  VALUES (new.id, new.email, 1, NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Attach Trigger to auth.users (Runs ONLY ONCE per new registered user)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 8. Atomic RPC function to safely deduct 1 credit (never below 0)
CREATE OR REPLACE FUNCTION public.deduct_user_credit(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  new_bal INTEGER;
BEGIN
  UPDATE public.profiles
  SET credits_balance = GREATEST(0, credits_balance - 1),
      updated_at = NOW()
  WHERE id = user_uuid
  RETURNING credits_balance INTO new_bal;
  
  RETURN COALESCE(new_bal, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Backfill any existing registered users who don't have a profile row yet
INSERT INTO public.profiles (id, email, credits_balance, updated_at)
SELECT id, email, 1, NOW()
FROM auth.users
ON CONFLICT (id) DO NOTHING;
