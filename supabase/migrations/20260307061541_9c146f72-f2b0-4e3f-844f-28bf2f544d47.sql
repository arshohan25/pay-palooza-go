ALTER TABLE spending_budgets
  ADD COLUMN is_recurring boolean NOT NULL DEFAULT true,
  ADD COLUMN last_reset_month text;