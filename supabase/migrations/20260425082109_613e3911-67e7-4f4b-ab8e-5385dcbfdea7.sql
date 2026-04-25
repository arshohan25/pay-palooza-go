-- Cleanup any old unconfirmed test rows
DELETE FROM auth.users WHERE email LIKE 'test-nonadmin-%@easypay.app';

-- Create a deterministic confirmed non-admin user for RLS tests
DO $$
DECLARE
  v_uid uuid := '00000000-0000-0000-0000-0000deadbeef';
  v_email text := 'rls-test-nonadmin@easypay.app';
  v_pwd text := 'RlsTestPass!2026';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_uid) THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      v_uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_pwd, gen_salt('bf')),
      now(),
      jsonb_build_object('provider','email','providers',ARRAY['email']),
      '{}'::jsonb,
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
    VALUES (
      gen_random_uuid(), v_uid, v_uid::text,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  END IF;
END $$;