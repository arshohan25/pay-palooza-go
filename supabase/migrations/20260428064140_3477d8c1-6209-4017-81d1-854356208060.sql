-- Add trust-token columns to trusted_devices
ALTER TABLE public.trusted_devices
  ADD COLUMN IF NOT EXISTS token_hash text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

CREATE INDEX IF NOT EXISTS trusted_devices_token_hash_idx
  ON public.trusted_devices (token_hash)
  WHERE token_hash IS NOT NULL AND revoked_at IS NULL;

-- One-time OTP ticket replay protection
CREATE TABLE IF NOT EXISTS public.otp_tickets_used (
  jti text PRIMARY KEY,
  phone text NOT NULL,
  portal text NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

ALTER TABLE public.otp_tickets_used ENABLE ROW LEVEL SECURITY;

-- No policies: only service role (which bypasses RLS) can touch this table.

CREATE INDEX IF NOT EXISTS otp_tickets_used_expires_idx
  ON public.otp_tickets_used (expires_at);
