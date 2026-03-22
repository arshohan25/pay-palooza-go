
-- Loan applications table
CREATE TABLE public.loan_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  tenure_days integer NOT NULL,
  interest_rate numeric NOT NULL DEFAULT 5,
  emi_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  applied_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_loan_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected', 'disbursed', 'repaid') THEN
    RAISE EXCEPTION 'Invalid loan status';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_loan_status BEFORE INSERT OR UPDATE ON public.loan_applications FOR EACH ROW EXECUTE FUNCTION validate_loan_status();

ALTER TABLE public.loan_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own loans" ON public.loan_applications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own loans" ON public.loan_applications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage all loans" ON public.loan_applications FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Insurance policies table
CREATE TABLE public.insurance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type text NOT NULL,
  plan_name text NOT NULL,
  coverage_amount numeric NOT NULL,
  premium numeric NOT NULL,
  duration_months integer NOT NULL,
  status text NOT NULL DEFAULT 'active',
  purchased_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_insurance_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('active', 'expired', 'cancelled', 'claimed') THEN
    RAISE EXCEPTION 'Invalid insurance status';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_insurance_status BEFORE INSERT OR UPDATE ON public.insurance_policies FOR EACH ROW EXECUTE FUNCTION validate_insurance_status();

ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own policies" ON public.insurance_policies FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own policies" ON public.insurance_policies FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage all policies" ON public.insurance_policies FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Gift cards table
CREATE TABLE public.gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchaser_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_phone text,
  brand text NOT NULL,
  denomination numeric NOT NULL,
  code text NOT NULL DEFAULT upper(substring(gen_random_uuid()::text FROM 1 FOR 8)),
  status text NOT NULL DEFAULT 'active',
  purchased_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz,
  redeemed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_gift_card_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('active', 'redeemed', 'expired') THEN
    RAISE EXCEPTION 'Invalid gift card status';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_gift_card_status BEFORE INSERT OR UPDATE ON public.gift_cards FOR EACH ROW EXECUTE FUNCTION validate_gift_card_status();

ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own gift cards" ON public.gift_cards FOR SELECT TO authenticated USING (purchaser_id = auth.uid());
CREATE POLICY "Users insert own gift cards" ON public.gift_cards FOR INSERT TO authenticated WITH CHECK (purchaser_id = auth.uid());
CREATE POLICY "Admins manage all gift cards" ON public.gift_cards FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at triggers
CREATE TRIGGER update_loan_applications_updated_at BEFORE UPDATE ON public.loan_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_insurance_policies_updated_at BEFORE UPDATE ON public.insurance_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_gift_cards_updated_at BEFORE UPDATE ON public.gift_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
