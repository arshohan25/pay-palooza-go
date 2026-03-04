-- Temporarily disable the protect trigger to allow phone repair
ALTER TABLE public.profiles DISABLE TRIGGER protect_profile_fields_trigger;

-- Repair corrupted phone values
UPDATE public.profiles
SET phone = REPLACE(phone, '@easypay.local', '')
WHERE phone LIKE '%@easypay.local';

-- Re-enable the trigger
ALTER TABLE public.profiles ENABLE TRIGGER protect_profile_fields_trigger;