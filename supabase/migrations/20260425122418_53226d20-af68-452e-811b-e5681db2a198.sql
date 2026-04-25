ALTER TABLE public.contributions DROP CONSTRAINT IF EXISTS contributions_method_check;
ALTER TABLE public.contributions
  ADD CONSTRAINT contributions_method_check
  CHECK (method IS NULL OR method IN ('mobile_money', 'bank', 'card', 'cash'));