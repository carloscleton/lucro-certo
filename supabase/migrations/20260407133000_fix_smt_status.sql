-- Update SMT company to past_due manually
UPDATE public.companies 
SET subscription_status = 'past_due'
WHERE trade_name ILIKE '%SMT%';
