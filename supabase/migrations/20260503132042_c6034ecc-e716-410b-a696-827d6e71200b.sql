
ALTER TABLE public.merchant_staff_permission_requests
  DROP CONSTRAINT IF EXISTS merchant_staff_permission_requests_permission_key_check;

ALTER TABLE public.merchant_staff_permission_requests
  ADD CONSTRAINT merchant_staff_permission_requests_permission_key_check
  CHECK (permission_key IN ('payouts','store_settings','settlements','add_bank'));
