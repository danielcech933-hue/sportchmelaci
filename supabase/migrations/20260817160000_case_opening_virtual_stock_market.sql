-- Case Opening: virtual share collectibles paid with betting dollars.
-- No real securities, no market pricing and no real-world ownership.
-- Access: Danko, Chlaďar/Chladar, Midas/M1das only.

CREATE TABLE IF NOT EXISTS public.case_opening_stock_cases (
  id text PRIMARY KEY,
  name text NOT NULL,
  sector text NOT NULL,
  cost numeric(30,2) NOT NULL CHECK (cost >= 10000000000),
  description text NOT NULL,
  accent text NOT NULL DEFAULT 'gold',
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.case_opening_stock_companies (
  id bigserial PRIMARY KEY,
  company_name text NOT NULL,
  ticker text NOT NULL UNIQUE,
  sector text NOT NULL,
  company_tier integer NOT NULL CHECK (company_tier BETWEEN 1 AND 6),
  rarity_note text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.case_opening_stock_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  case_id text NOT NULL REFERENCES public.case_opening_stock_cases(id),
  company_id bigint NOT NULL REFERENCES public.case_opening_stock_companies(id),
  company_name text NOT NULL,
  ticker text NOT NULL,
  sector text NOT NULL,
  share_count bigint NOT NULL CHECK (share_count > 0),
  rarity text NOT NULL,
  rarity_score integer NOT NULL,
  serial text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.case_opening_stock_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  case_id text NOT NULL REFERENCES public.case_opening_stock_cases(id),
  case_cost numeric(30,2) NOT NULL,
  company_name text NOT NULL,
  ticker text NOT NULL,
  sector text NOT NULL,
  share_count bigint NOT NULL,
  rarity text NOT NULL,
  rarity_score integer NOT NULL,
  serial text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.case_opening_stock_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_opening_stock_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS case_opening_stock_inventory_select_own ON public.case_opening_stock_inventory;
DROP POLICY IF EXISTS case_opening_stock_history_select_own ON public.case_opening_stock_history;
CREATE POLICY case_opening_stock_inventory_select_own ON public.case_opening_stock_inventory FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY case_opening_stock_history_select_own ON public.case_opening_stock_history FOR SELECT TO authenticated USING (user_id = auth.uid());

INSERT INTO public.case_opening_stock_cases (id,name,sector,cost,description,accent) VALUES
('tech','TECHNOLOGY VAULT','Technology',10000000000,'Semiconductors, cloud, robotics and future infrastructure.','cyan'),
('ai','AI / CLOUD BLACKBOX','AI & Cloud',25000000000,'Frontier models, AI compute and cloud architecture.','violet'),
('finance','FINANCE DYNASTY','Finance',50000000000,'Banks, exchanges, payments and market infrastructure.','emerald'),
('energy','ENERGY FRONTIER','Energy',75000000000,'Fusion, renewables, grid storage and advanced materials.','amber'),
('gaming','GAMING & MEDIA','Gaming & Media',100000000000,'Games, streaming, media tech and digital worlds.','pink'),
('mobility','MOBILITY TITANS','Mobility',125000000000,'Autonomy, EV systems, aerospace mobility and logistics.','orange'),
('industrial','INDUSTRIAL CORE','Industry',150000000000,'Robotics, aerospace and advanced manufacturing.','slate'),
('global','GLOBAL GIANTS','Global',250000000000,'Cross-sector pool with boosted high-tier odds.','gold'),
('quantum','QUANTUM FRONTIER','Quantum',500000000000,'Quantum compute, photonics and frontier science.','fuchsia'),
('omega','OMEGA BLACK RESERVE','Omega',1000000000000,'Rarest companies and the smallest share lots.','gold')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,sector=EXCLUDED.sector,cost=EXCLUDED.cost,description=EXCLUDED.description,accent=EXCLUDED.accent,active=true;

INSERT INTO public.case_opening_stock_companies(company_name,ticker,sector,company_tier,rarity_note) VALUES
('Aetherion Systems','AETH','Technology',6,'Frontier AI infrastructure'),('NovaForge Silicon','NFOR','Technology',5,'Advanced compute'),('Cloudspire Grid','CSPD','Technology',5,'Cloud architecture'),('Lumina Robotics','LROB','Technology',4,'Industrial robotics'),('VectorCore Labs','VCRL','Technology',4,'Developer platforms'),('PixelPeak Networks','PPNX','Technology',3,'Consumer platforms'),('OrbitStack','ORBT','Technology',3,'Cloud tools'),('Neon Circuit','NEON','Technology',2,'Consumer electronics'),('ByteHarbor','BYHR','Technology',2,'Digital services'),('CodeFoundry','CDFY','Technology',1,'Software tools'),
('Cortex Nova','CRTX','AI & Cloud',6,'Frontier model research'),('DeepOrbit Compute','DOCM','AI & Cloud',6,'AI compute'),('HelixMind','HLMN','AI & Cloud',5,'Applied intelligence'),('CloudTitan','CLTN','AI & Cloud',5,'Hyperscale cloud'),('TensorWorks','TNWK','AI & Cloud',4,'Accelerated compute'),('PromptLab','PMLB','AI & Cloud',4,'AI tooling'),('ModelMesh','MMSH','AI & Cloud',3,'Model operations'),('VectorMind','VMND','AI & Cloud',3,'AI applications'),
('Crown Meridian Bank','CMBK','Finance',6,'Global finance'),('Atlas Exchange Group','AEXG','Finance',6,'Digital exchange'),('Northstar Capital','NSCP','Finance',5,'Asset management'),('Granite Payments','GRPY','Finance',5,'Payments'),('BlueLedger','BLDG','Finance',4,'Financial rails'),('PrimeVault Holdings','PVHL','Finance',4,'Wealth tech'),('QuantBridge','QNBG','Finance',3,'Quant markets'),('MintSphere','MNSP','Finance',3,'Consumer finance'),
('HelioFusion Energy','HFEN','Energy',6,'Fusion research'),('Solaris Grid','SLGR','Energy',6,'Renewable infrastructure'),('VoltAxis','VTAX','Energy',5,'Grid storage'),('TerraCore Materials','TCMT','Energy',5,'Advanced materials'),('Hydra Renewables','HYDR','Energy',4,'Hydrogen systems'),('NovaWind','NWND','Energy',4,'Wind infrastructure'),
('Arcadia Interactive','ARCI','Gaming & Media',6,'Mega entertainment platform'),('PixelNova Studios','PNVS','Gaming & Media',5,'AAA game studio'),('StreamForge','STFG','Gaming & Media',5,'Streaming technology'),('DreamFrame','DRFM','Gaming & Media',4,'Digital content'),('ArenaVerse','ARVR','Gaming & Media',4,'Virtual worlds'),
('AeroPulse Mobility','APMO','Mobility',6,'Autonomous mobility'),('VoltMotion','VLMT','Mobility',6,'Electric platforms'),('SkyRail Dynamics','SKRD','Mobility',5,'Next-gen transit'),('RoadForge','RDFG','Mobility',5,'Autonomous fleets'),
('Titanium Works','TIWK','Industry',6,'Heavy industry'),('Orbital Foundry','ORFD','Industry',6,'Aerospace manufacturing'),('RoboAxis','RBAX','Industry',5,'Industrial automation'),('SkyHammer Aerospace','SKHA','Industry',5,'Aerospace'),
('Aurora Global','AURG','Global',6,'Cross-sector giant'),('Meridian Prime','MDPR','Global',6,'Global conglomerate'),('Nexus Holdings','NXHD','Global',5,'Diversified growth'),('Summit United','SMUN','Global',5,'Global infrastructure'),
('Qubit Dominion','QBDM','Quantum',6,'Quantum compute'),('PhotonArc','PHAR','Quantum',6,'Photonic computing'),('Entangle Labs','ENTL','Quantum',6,'Quantum networking'),('CryoCore','CRYO','Quantum',5,'Cryogenic systems')
ON CONFLICT (ticker) DO UPDATE SET company_name=EXCLUDED.company_name,sector=EXCLUDED.sector,company_tier=EXCLUDED.company_tier,rarity_note=EXCLUDED.rarity_note;

CREATE OR REPLACE FUNCTION public.case_opening_stock_open(_case_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE uid uuid:=auth.uid(); nick text; bal numeric; c record; co record; roll numeric; shares bigint; scarcity int; score int; rarity text; serial text; next_bal numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT p.nickname,p.balance INTO nick,bal FROM public.profiles p WHERE p.id=uid FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;
  IF lower(trim(coalesce(nick,''))) NOT IN ('danko','chlaďar','chladar','midas','m1das') THEN RAISE EXCEPTION 'case_opening_forbidden'; END IF;
  SELECT * INTO c FROM public.case_opening_stock_cases WHERE id=lower(trim(_case_id)) AND active=true;
  IF c.id IS NULL THEN RAISE EXCEPTION 'invalid_case'; END IF;
  IF bal<c.cost THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  IF c.sector IN ('Global','Omega') THEN
    SELECT * INTO co FROM public.case_opening_stock_companies ORDER BY power(random(),1.0/(company_tier+1)) DESC LIMIT 1;
  ELSIF c.sector='AI & Cloud' THEN
    SELECT * INTO co FROM public.case_opening_stock_companies WHERE sector IN ('AI & Cloud','Technology') ORDER BY power(random(),1.0/(company_tier+1)) DESC LIMIT 1;
  ELSE
    SELECT * INTO co FROM public.case_opening_stock_companies WHERE sector=c.sector ORDER BY power(random(),1.0/(company_tier+1)) DESC LIMIT 1;
  END IF;
  IF co.id IS NULL THEN RAISE EXCEPTION 'no_drop_pool'; END IF;
  roll=random();
  IF c.id='omega' THEN
    shares:=CASE WHEN roll<0.04 THEN 1 WHEN roll<0.16 THEN 2+floor(random()*9)::bigint WHEN roll<0.42 THEN 10+floor(random()*41)::bigint WHEN roll<0.72 THEN 50+floor(random()*451)::bigint ELSE 500+floor(random()*4501)::bigint END;
  ELSE
    shares:=CASE WHEN roll<0.06 THEN 1+floor(random()*24)::bigint WHEN roll<0.20 THEN 25+floor(random()*76)::bigint WHEN roll<0.48 THEN 100+floor(random()*901)::bigint WHEN roll<0.78 THEN 1000+floor(random()*9001)::bigint ELSE 10000+floor(random()*990001)::bigint END;
  END IF;
  scarcity:=CASE WHEN shares<=5 THEN 60 WHEN shares<=25 THEN 50 WHEN shares<=100 THEN 40 WHEN shares<=1000 THEN 30 WHEN shares<=10000 THEN 20 WHEN shares<=100000 THEN 10 ELSE 0 END;
  score:=co.company_tier*10+scarcity;
  rarity:=CASE WHEN score>=110 THEN 'MYTHIC' WHEN score>=90 THEN 'ULTRA' WHEN score>=70 THEN 'LEGENDARY' WHEN score>=55 THEN 'EPIC' WHEN score>=40 THEN 'RARE' WHEN score>=25 THEN 'UNCOMMON' ELSE 'COMMON' END;
  serial:='STK-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))||'-'||upper(substr(md5(uid::text||clock_timestamp()::text||co.ticker),1,8));
  next_bal:=round(bal-c.cost,2);
  UPDATE public.profiles SET balance=next_bal,updated_at=now() WHERE id=uid;
  INSERT INTO public.case_opening_stock_inventory(user_id,case_id,company_id,company_name,ticker,sector,share_count,rarity,rarity_score,serial) VALUES(uid,c.id,co.id,co.company_name,co.ticker,co.sector,shares,rarity,score,serial);
  INSERT INTO public.case_opening_stock_history(user_id,case_id,case_cost,company_name,ticker,sector,share_count,rarity,rarity_score,serial) VALUES(uid,c.id,c.cost,co.company_name,co.ticker,co.sector,shares,rarity,score,serial);
  RETURN jsonb_build_object('case_id',c.id,'case_name',c.name,'cost',c.cost,'company_name',co.company_name,'ticker',co.ticker,'sector',co.sector,'share_count',shares,'rarity',rarity,'rarity_score',score,'serial',serial,'balance',next_bal,'virtual_only',true);
END; $$;
REVOKE ALL ON FUNCTION public.case_opening_stock_open(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.case_opening_stock_open(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.case_opening_stock_inventory_summary()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='public' AS $$
SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC),'[]'::jsonb) FROM (
  SELECT case_id,company_name,ticker,sector,share_count,rarity,rarity_score,serial,created_at
  FROM public.case_opening_stock_inventory WHERE user_id=auth.uid() ORDER BY created_at DESC LIMIT 100
) x;
$$;
REVOKE ALL ON FUNCTION public.case_opening_stock_inventory_summary() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.case_opening_stock_inventory_summary() TO authenticated;
