ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'high_roller';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'case_opener';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'restricted';

REVOKE ALL ON public.case_opening_stock_cases FROM anon, authenticated;
REVOKE ALL ON public.case_opening_stock_companies FROM anon, authenticated;
REVOKE ALL ON public.roulette_settlement_ledger FROM anon, authenticated;
GRANT ALL ON public.case_opening_stock_cases TO service_role;
GRANT ALL ON public.case_opening_stock_companies TO service_role;
GRANT ALL ON public.roulette_settlement_ledger TO service_role;
ALTER TABLE public.case_opening_stock_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_opening_stock_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roulette_settlement_ledger ENABLE ROW LEVEL SECURITY;

REVOKE EXECUTE ON FUNCTION public.get_my_wallet() FROM anon;

CREATE OR REPLACE FUNCTION public.roulette_result(_round_no bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v integer;
BEGIN
  LOOP
    v := get_byte(gen_random_bytes(1), 0);
    EXIT WHEN v < 222; -- 222 = 6 * 37, keeps the modulo unbiased
  END LOOP;
  RETURN (v % 37);
END;
$function$;

REVOKE ALL ON FUNCTION public.roulette_result(bigint) FROM PUBLIC, anon, authenticated;