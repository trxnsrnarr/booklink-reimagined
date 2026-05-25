ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_amount_idr_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_amount_idr_check CHECK (amount_idr >= 0);