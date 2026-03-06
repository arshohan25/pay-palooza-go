
-- Harden profiles RLS policies with explicit auth.uid() IS NOT NULL guards

-- 1. Users can view own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 2. Users can create own profile
DROP POLICY IF EXISTS "Users can create own profile" ON public.profiles;
CREATE POLICY "Users can create own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 3. Users can update own profile metadata
DROP POLICY IF EXISTS "Users can update own profile metadata" ON public.profiles;
CREATE POLICY "Users can update own profile metadata" ON public.profiles
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND balance = (SELECT p.balance FROM profiles p WHERE p.user_id = auth.uid())
    AND phone = (SELECT p.phone FROM profiles p WHERE p.user_id = auth.uid())
    AND status = (SELECT p.status FROM profiles p WHERE p.user_id = auth.uid())
  );

-- Harden kyc_verifications RLS policies

-- 4. Users can view own kyc
DROP POLICY IF EXISTS "Users can view own kyc" ON public.kyc_verifications;
CREATE POLICY "Users can view own kyc" ON public.kyc_verifications
  FOR SELECT USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 5. Users can create own kyc
DROP POLICY IF EXISTS "Users can create own kyc" ON public.kyc_verifications;
CREATE POLICY "Users can create own kyc" ON public.kyc_verifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 6. Users can update own pending kyc
DROP POLICY IF EXISTS "Users can update own pending kyc" ON public.kyc_verifications;
CREATE POLICY "Users can update own pending kyc" ON public.kyc_verifications
  FOR UPDATE USING (auth.uid() IS NOT NULL AND auth.uid() = user_id AND status = 'pending');
