ALTER TABLE public.contributions
  ADD COLUMN IF NOT EXISTS payment_link TEXT,
  ADD COLUMN IF NOT EXISTS payment_method_used TEXT;

CREATE INDEX IF NOT EXISTS idx_contributions_order_ref
  ON public.contributions (clickpesa_order_reference);