CREATE TABLE IF NOT EXISTS public.case_opening_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  case_id text NOT NULL,
  case_cost numeric(14,2) NOT NULL,
  reward_czk numeric(14,2) NOT NULL,
  rarity text NOT NULL,
  reward_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.case_opening_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS case_opening_history_select_own ON public.case_opening_history;
CREATE POLICY case_opening_history_select_own ON public.case_opening_history
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.case_opening_open(_case_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_nickname text;
  balance numeric;
  case_cost numeric;
  reward numeric;
  rarity text;
  reward_label text;
  roll numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT p.nickname, p.slot_czk INTO v_nickname, balance
  FROM public.profiles AS p WHERE p.id = uid FOR UPDATE;

  IF balance IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;
  IF lower(trim(coalesce(v_nickname,''))) NOT IN ('danko','chlaďar','chladar','midas','m1das') THEN
    RAISE EXCEPTION 'case_opening_forbidden';
  END IF;

  CASE lower(trim(_case_id))
    WHEN 'starter' THEN case_cost := 100;
    WHEN 'gold' THEN case_cost := 500;
    WHEN 'mythic' THEN case_cost := 2500;
    ELSE RAISE EXCEPTION 'invalid_case';
  END CASE;

  IF balance < case_cost THEN RAISE EXCEPTION 'insufficient_slot'; END IF;
  balance := balance - case_cost;
  roll := random();

  IF lower(trim(_case_id)) = 'starter' THEN
    IF roll < 0.45 THEN reward := 75; rarity := 'COMMON'; reward_label := 'CHMEL TOKENS';
    ELSIF roll < 0.75 THEN reward := 125; rarity := 'UNCOMMON'; reward_label := 'GOLD CREDITS';
    ELSIF roll < 0.92 THEN reward := 250; rarity := 'RARE'; reward_label := 'PREMIUM DROP';
    ELSIF roll < 0.99 THEN reward := 500; rarity := 'EPIC'; reward_label := 'EPIC JACKPOT';
    ELSE reward := 1000; rarity := 'LEGENDARY'; reward_label := 'MYTHIC HIT'; END IF;
  ELSIF lower(trim(_case_id)) = 'gold' THEN
    IF roll < 0.38 THEN reward := 350; rarity := 'COMMON'; reward_label := 'GOLD CACHE';
    ELSIF roll < 0.70 THEN reward := 650; rarity := 'UNCOMMON'; reward_label := 'VAULT CREDITS';
    ELSIF roll < 0.90 THEN reward := 1200; rarity := 'RARE'; reward_label := 'ROYAL DROP';
    ELSIF roll < 0.985 THEN reward := 2500; rarity := 'EPIC'; reward_label := 'CHAMPION CACHE';
    ELSE reward := 10000; rarity := 'LEGENDARY'; reward_label := 'GOLDEN GOD DROP'; END IF;
  ELSE
    IF roll < 0.34 THEN reward := 1500; rarity := 'COMMON'; reward_label := 'MYTHIC SHARD';
    ELSIF roll < 0.63 THEN reward := 3000; rarity := 'UNCOMMON'; reward_label := 'DIAMOND CACHE';
    ELSIF roll < 0.84 THEN reward := 7500; rarity := 'RARE'; reward_label := 'DRAGON DROP';
    ELSIF roll < 0.97 THEN reward := 15000; rarity := 'EPIC'; reward_label := 'OBSIDIAN VAULT';
    ELSIF roll < 0.995 THEN reward := 50000; rarity := 'LEGENDARY'; reward_label := 'GODMODE CACHE';
    ELSE reward := 100000; rarity := 'ULTRA'; reward_label := 'SPORTCHMELÁCI JACKPOT'; END IF;
  END IF;

  balance := balance + reward;
  UPDATE public.profiles SET slot_czk = round(balance,2), updated_at = now() WHERE id = uid;
  INSERT INTO public.case_opening_history(user_id,case_id,case_cost,reward_czk,rarity,reward_label)
  VALUES(uid, lower(trim(_case_id)), case_cost, reward, rarity, reward_label);

  RETURN jsonb_build_object(
    'case_id', lower(trim(_case_id)),
    'cost', case_cost,
    'reward_czk', reward,
    'rarity', rarity,
    'reward_label', reward_label,
    'slot_czk', round(balance,2)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.case_opening_open(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.case_opening_open(text) TO authenticated;
