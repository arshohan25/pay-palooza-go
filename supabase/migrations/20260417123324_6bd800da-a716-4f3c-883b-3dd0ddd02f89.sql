UPDATE public.savings_goals
SET withdrawn_at = COALESCE(withdrawn_at, updated_at, created_at),
    withdrawn_amount = COALESCE(withdrawn_amount, target_amount)
WHERE status = 'withdrawn'
  AND (withdrawn_at IS NULL OR withdrawn_amount IS NULL);