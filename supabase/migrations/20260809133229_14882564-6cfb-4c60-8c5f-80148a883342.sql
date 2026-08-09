-- CATALOG
CREATE TABLE public.fc_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  rating integer NOT NULL,
  position text NOT NULL,
  nation text NOT NULL,
  club text NOT NULL,
  league text NOT NULL DEFAULT 'Other',
  card_type text NOT NULL DEFAULT 'gold',
  image_url text,
  pac integer NOT NULL DEFAULT 70,
  sho integer NOT NULL DEFAULT 70,
  pas integer NOT NULL DEFAULT 70,
  dri integer NOT NULL DEFAULT 70,
  def integer NOT NULL DEFAULT 70,
  phy integer NOT NULL DEFAULT 70,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fc_cards TO authenticated;
GRANT ALL ON public.fc_cards TO service_role;
ALTER TABLE public.fc_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fc cards readable" ON public.fc_cards FOR SELECT TO authenticated USING (true);

-- USER CARDS
CREATE TABLE public.fc_user_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.fc_cards(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fc_user_cards_user_idx ON public.fc_user_cards(user_id);
GRANT SELECT ON public.fc_user_cards TO authenticated;
GRANT ALL ON public.fc_user_cards TO service_role;
ALTER TABLE public.fc_user_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cards readable" ON public.fc_user_cards FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- PACKS
CREATE TABLE public.fc_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_type text NOT NULL DEFAULT 'gold',
  source text NOT NULL DEFAULT 'reward',
  opened boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fc_packs_user_idx ON public.fc_packs(user_id);
GRANT SELECT ON public.fc_packs TO authenticated;
GRANT ALL ON public.fc_packs TO service_role;
ALTER TABLE public.fc_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own packs readable" ON public.fc_packs FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- SQUADS
CREATE TABLE public.fc_squads (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  formation text NOT NULL DEFAULT '4-3-3',
  slots jsonb NOT NULL DEFAULT '{}'::jsonb,
  team_ovr integer NOT NULL DEFAULT 0,
  chemistry integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fc_squads TO authenticated;
GRANT ALL ON public.fc_squads TO service_role;
ALTER TABLE public.fc_squads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "squads readable" ON public.fc_squads FOR SELECT TO authenticated USING (true);

-- CHALLENGES
CREATE TABLE public.fc_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'gold',
  ovr_cap integer,
  status text NOT NULL DEFAULT 'open',
  host_ready boolean NOT NULL DEFAULT false,
  opponent_ready boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fc_challenges TO authenticated;
GRANT ALL ON public.fc_challenges TO service_role;
ALTER TABLE public.fc_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "challenges readable" ON public.fc_challenges FOR SELECT TO authenticated USING (true);

CREATE TRIGGER fc_squads_updated BEFORE UPDATE ON public.fc_squads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER fc_challenges_updated BEFORE UPDATE ON public.fc_challenges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SEED CATALOG
INSERT INTO public.fc_cards (key,name,rating,position,nation,club,league,card_type,pac,sho,pas,dri,def,phy) VALUES
('mbappe','K. Mbappé',95,'ST','France','Real Madrid','LaLiga','totw',97,93,82,93,36,78),
('haaland','E. Haaland',92,'ST','Norway','Manchester City','Premier League','gold',89,94,68,81,45,89),
('bellingham','J. Bellingham',90,'CAM','England','Real Madrid','LaLiga','gold',83,86,85,89,78,84),
('yamal','L. Yamal',89,'RW','Spain','FC Barcelona','LaLiga','totw',88,82,86,93,34,62),
('vinicius','Vinícius Jr.',92,'LW','Brazil','Real Madrid','LaLiga','gold',95,88,80,94,29,70),
('rodri','Rodri',91,'CM','Spain','Manchester City','Premier League','gold',70,80,89,86,86,84),
('vandijk','V. van Dijk',89,'CB','Netherlands','Liverpool','Premier League','gold',78,60,71,72,90,88),
('saliba','W. Saliba',87,'CB','France','Arsenal','Premier League','gold',81,42,64,72,87,84),
('hakimi','A. Hakimi',86,'RB','Morocco','Paris SG','Ligue 1','gold',93,76,80,85,78,76),
('davies','A. Davies',85,'LB','Canada','Bayern München','Bundesliga','gold',95,70,79,86,78,76),
('courtois','T. Courtois',90,'GK','Belgium','Real Madrid','LaLiga','gold',54,38,45,50,52,80),
('donnarumma','G. Donnarumma',88,'GK','Italy','Paris SG','Ligue 1','gold',52,40,47,53,50,84),
('zlatan','Z. Ibrahimović',93,'ST','Sweden','Icons','Icons','icon',80,95,84,89,45,93),
('zidane','Z. Zidane',96,'CAM','France','Icons','Icons','icon',80,85,96,96,72,86),
('ronaldinho','Ronaldinho',94,'CAM','Brazil','Icons','Icons','icon',88,88,92,97,35,79),
('kaka','Kaká',92,'CAM','Brazil','Icons','Icons','promo',89,86,84,92,42,80);