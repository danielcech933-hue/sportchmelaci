CREATE OR REPLACE FUNCTION public.fc_seed_catalog()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  firsts text[] := ARRAY['Lukas','Marek','Tomas','Jan','Adam','Ondrej','Petr','Filip','David','Martin','Jakub','Vojtech','Dominik','Matej','Simon','Kevin','Luca','Mateo','Diego','Rafael','Andre','Bruno','Hugo','Theo','Noah','Elias','Emil','Viktor','Nikola','Marko','Ilias','Youssef','Amine','Karim','Omar','Ibrahim','Samuel','Daniel','Gabriel','Leon','Felix','Jonas','Milan','Sergio','Pablo','Alvaro','Iker','Unai','Mikel','Aitor','Enzo','Nathan','Julien','Maxime','Antoine','Florian','Tiago','Joao','Pedro','Nuno','Ruben','Kai','Jesse','Owen','Callum','Freddie','Archie','Reece','Kwame','Kofi','Musa','Sadio','Idrissa','Takumi','Ryo','Sho','Minjae','Jaehyun','Santiago','Facundo','Nicolas','Emiliano','Lautaro','Thiago','Vinicius','Matheus','Caio','Igor','Wesley','Alex','Robin','Sven','Lars','Jesper','Anton','Oskar','Aron','Stefan','Zoran','Ante','Ivan','Dario','Andrej','Roman','Denis','Radek','Patrik','Michal','Zdenek','Vaclav','Josef','Karel','Stanislav','Bohdan','Taras','Yusuf','Emre','Arda','Cenk','Kerem','Hakan'];
  lasts text[] := ARRAY['Novak','Svoboda','Dvorak','Chmelik','Kovar','Prochazka','Vesely','Horak','Sedlacek','Blaha','Hopfner','Silva','Santos','Costa','Ferreira','Oliveira','Pereira','Gomez','Garcia','Martinez','Fernandez','Lopez','Sanchez','Ruiz','Torres','Moreno','Rossi','Ferrari','Esposito','Romano','Ricci','Muller','Schneider','Weber','Fischer','Becker','Hoffmann','Wagner','Dubois','Lefevre','Moreau','Girard','Bernard','Rousseau','Jansen','Visser','Bakker','Smit','Devries','Andersen','Nielsen','Larsen','Lindgren','Johansson','Berg','Novikov','Kovalenko','Shevchenko','Melnyk','Bilic','Modric','Perisic','Vlasic','Kovacic','Yilmaz','Demir','Kaya','Aydin','Ozturk','Diallo','Traore','Toure','Keita','Mane','Bah','Osei','Mensah','Okafor','Eze','Adeyemi','Tanaka','Sato','Ito','Nakamura','Kim','Park','Lee','Choi','Herrera','Ramirez','Castillo','Vargas','Mendoza','Rojas','Cruz','Reyes','Smith','Johnson','Williams','Brown','Taylor','Wilson','Davies','Evans','Roberts','Walker','Hughes','Clarke','Bennett','Foster','Hunter','Grant','Stone','Ward','Reid','Cole','Baker','Palmer','Quinn','Doyle','Murphy','Kelly','Byrne','Fitzgerald'];
  nations text[] := ARRAY['France','England','Spain','Brazil','Germany','Italy','Portugal','Argentina','Netherlands','Belgium','Norway','Croatia','Morocco','Uruguay','Poland','Czechia','Sweden','Denmark','Japan','Korea Republic','Nigeria','Senegal','Colombia','Mexico','USA','Canada','Serbia','Turkiye','Austria','Switzerland','Ukraine','Slovakia','Egypt','Ghana','Ivory Coast','Australia'];
  leagues text[] := ARRAY['Premier League','La Liga','Serie A','Bundesliga','Ligue 1','Chance Liga','Eredivisie','Liga Portugal','Saudi League','MLS'];
  clubs text[][] := ARRAY[
    ARRAY['Manchester City','Arsenal','Liverpool','Chelsea','Tottenham','Newcastle'],
    ARRAY['Real Madrid','Barcelona','Atletico Madrid','Athletic Club','Real Sociedad','Villarreal'],
    ARRAY['Inter','AC Milan','Juventus','Napoli','Roma','Atalanta'],
    ARRAY['Bayern Munchen','Bayer Leverkusen','Borussia Dortmund','RB Leipzig','Stuttgart','Freiburg'],
    ARRAY['Paris SG','Monaco','Marseille','Lille','Lyon','Nice'],
    ARRAY['Slavia Praha','Sparta Praha','Viktoria Plzen','Banik Ostrava','Sigma Olomouc','Slovan Liberec'],
    ARRAY['Ajax','PSV','Feyenoord','AZ Alkmaar','Twente','Utrecht'],
    ARRAY['Benfica','Porto','Sporting CP','Braga','Vitoria Guimaraes','Boavista'],
    ARRAY['Al Nassr','Al Hilal','Al Ittihad','Al Ahli','Al Shabab','Al Ettifaq'],
    ARRAY['Inter Miami','LAFC','Atlanta United','Seattle Sounders','NY Red Bulls','Austin FC']
  ];
  gk_pos text[] := ARRAY['GK'];
  def_pos text[] := ARRAY['CB','CB','CB','LB','RB','LWB','RWB'];
  mid_pos text[] := ARRAY['CDM','CM','CM','CAM','LM','RM'];
  att_pos text[] := ARRAY['ST','ST','CF','LW','RW'];
  plan_group text[] := ARRAY['GK','DEF','MID','ATT'];
  rar_mix text[] := ARRAY['COMMON','COMMON','RARE','RARE','RARE','SUPER_RARE','SUPER_RARE','SPECIAL','HERO','ICON','EVENT','LEGENDARY','UNIQUE'];
  grp text; rarity text; pos text; nm text; k text;
  li int; nat text; club text;
  rating int; lo int; hi int;
  pac int; sho int; pas int; dri int; dfn int; phy int;
  ps text[]; roles text[]; alt text[];
  i int; n int := 0; s bigint; idx int; ct text;
  cnt int;
  function_seed int;
  -- deterministic pseudo random helper values
  rv numeric;
BEGIN
  SELECT count(*) INTO cnt FROM public.fc_cards WHERE player_id IS NOT NULL;
  IF cnt > 100 THEN RETURN cnt; END IF;

  FOR i IN 1..204 LOOP
    s := ('x' || substr(md5('sportchmelaci-card-' || i::text), 1, 8))::bit(32)::bigint;
    grp := CASE
      WHEN i % 13 = 0 THEN 'GK'
      WHEN i % 4 = 1 THEN 'DEF'
      WHEN i % 4 = 2 THEN 'MID'
      ELSE 'ATT' END;
    rarity := rar_mix[1 + (i % array_length(rar_mix,1))];

    SELECT lo_hi.lo, lo_hi.hi INTO lo, hi FROM (
      SELECT CASE rarity
        WHEN 'COMMON' THEN 60 WHEN 'RARE' THEN 72 WHEN 'SUPER_RARE' THEN 80
        WHEN 'SPECIAL' THEN 84 WHEN 'HERO' THEN 86 WHEN 'ICON' THEN 90
        WHEN 'LEGENDARY' THEN 93 WHEN 'EVENT' THEN 84 ELSE 88 END AS lo,
        CASE rarity
        WHEN 'COMMON' THEN 71 WHEN 'RARE' THEN 79 WHEN 'SUPER_RARE' THEN 84
        WHEN 'SPECIAL' THEN 88 WHEN 'HERO' THEN 91 WHEN 'ICON' THEN 95
        WHEN 'LEGENDARY' THEN 97 WHEN 'EVENT' THEN 90 ELSE 93 END AS hi
    ) lo_hi;

    rating := lo + ((s / 7) % (hi - lo + 1))::int;
    pos := CASE grp
      WHEN 'GK' THEN gk_pos[1]
      WHEN 'DEF' THEN def_pos[1 + ((s / 11) % array_length(def_pos,1))::int]
      WHEN 'MID' THEN mid_pos[1 + ((s / 11) % array_length(mid_pos,1))::int]
      ELSE att_pos[1 + ((s / 11) % array_length(att_pos,1))::int] END;

    nm := firsts[1 + ((s / 3) % array_length(firsts,1))::int] || ' ' || lasts[1 + ((s / 17) % array_length(lasts,1))::int];
    k := lower(replace(nm, ' ', '_')) || '_' || i::text;
    li := 1 + ((s / 23) % array_length(leagues,1))::int;
    nat := nations[1 + ((s / 29) % array_length(nations,1))::int];
    club := clubs[li][1 + ((s / 31) % 6)::int];

    IF grp = 'GK' THEN
      pac := rating - 10; sho := rating - 25; pas := rating - 8; dri := rating - 10; dfn := rating - 20; phy := rating - 3;
    ELSIF grp = 'DEF' THEN
      pac := rating - 2; sho := rating - 24; pas := rating - 8; dri := rating - 7; dfn := rating + 2; phy := rating + 2;
    ELSIF grp = 'MID' THEN
      pac := rating - 3; sho := rating - 5; pas := rating + 2; dri := rating + 2; dfn := rating - 8; phy := rating - 4;
    ELSE
      pac := rating + 3; sho := rating + 2; pas := rating - 5; dri := rating + 2; dfn := rating - 25; phy := rating - 5;
    END IF;
    pac := LEAST(99, GREATEST(40, pac + ((s / 37) % 5)::int - 2));
    sho := LEAST(99, GREATEST(30, sho + ((s / 41) % 5)::int - 2));
    pas := LEAST(99, GREATEST(35, pas + ((s / 43) % 5)::int - 2));
    dri := LEAST(99, GREATEST(35, dri + ((s / 47) % 5)::int - 2));
    dfn := LEAST(99, GREATEST(25, dfn + ((s / 53) % 5)::int - 2));
    phy := LEAST(99, GREATEST(35, phy + ((s / 59) % 5)::int - 2));

    ps := string_to_array(CASE grp
      WHEN 'GK' THEN 'Aerial,Anticipate'
      WHEN 'DEF' THEN (ARRAY['Block,Bruiser','Intercept,Anticipate','Aerial,Relentless'])[1 + ((s / 61) % 3)::int]
      WHEN 'MID' THEN (ARRAY['Pinged Pass,Technical','Incisive Pass,First Touch','Long Ball,Relentless','Whipped Cross,Technical'])[1 + ((s / 61) % 4)::int]
      ELSE (ARRAY['Finesse Shot,Quick Step','Power Shot,Rapid','Technical,First Touch','Rapid,Quick Step'])[1 + ((s / 61) % 4)::int] END, ',');

    roles := string_to_array(CASE grp
      WHEN 'GK' THEN (ARRAY['Sweeper Keeper','Traditional Keeper'])[1 + ((s / 67) % 2)::int]
      WHEN 'DEF' THEN (ARRAY['Ball Playing Defender,Stopper','Full Back,Wing Back'])[1 + ((s / 67) % 2)::int]
      WHEN 'MID' THEN (ARRAY['Playmaker,Deep-Lying Playmaker','Box-to-Box,Holding Midfielder','Mezzala,Playmaker'])[1 + ((s / 67) % 3)::int]
      ELSE (ARRAY['Poacher,Advanced Forward','False 9,Target Forward','Inside Forward,Winger'])[1 + ((s / 67) % 3)::int] END, ',');

    alt := CASE pos
      WHEN 'CB' THEN ARRAY['RB','LB'] WHEN 'LB' THEN ARRAY['LWB','LM'] WHEN 'RB' THEN ARRAY['RWB','RM']
      WHEN 'LWB' THEN ARRAY['LB'] WHEN 'RWB' THEN ARRAY['RB'] WHEN 'CDM' THEN ARRAY['CM','CB']
      WHEN 'CM' THEN ARRAY['CAM','CDM'] WHEN 'CAM' THEN ARRAY['CM','CF'] WHEN 'LM' THEN ARRAY['LW']
      WHEN 'RM' THEN ARRAY['RW'] WHEN 'ST' THEN ARRAY['CF'] WHEN 'CF' THEN ARRAY['ST','CAM']
      WHEN 'LW' THEN ARRAY['LM','ST'] WHEN 'RW' THEN ARRAY['RM','ST'] ELSE ARRAY[]::text[] END;

    ct := CASE rarity
      WHEN 'COMMON' THEN 'gold' WHEN 'RARE' THEN 'gold' WHEN 'SUPER_RARE' THEN 'totw'
      WHEN 'ICON' THEN 'icon' WHEN 'LEGENDARY' THEN 'icon' WHEN 'UNIQUE' THEN 'icon' ELSE 'promo' END;

    PERFORM public.fc_seed_card(k, nm, nat, club, leagues[li], pos, rating, rarity,
      pac, sho, pas, dri, dfn, phy, ct, ps, roles, alt);
    n := n + 1;
  END LOOP;

  UPDATE public.fc_cards c SET campaign = 'Chmeloví Hrdinové' WHERE c.rarity = 'HERO' AND c.campaign IS NULL;
  UPDATE public.fc_cards c SET campaign = 'Měňavci' WHERE c.rarity = 'EVENT' AND c.campaign IS NULL;
  UPDATE public.fc_cards c SET campaign = 'Legendy Chmele' WHERE c.rarity IN ('ICON','LEGENDARY') AND c.campaign IS NULL;
  UPDATE public.fc_cards c SET campaign = 'Future Stars' WHERE c.rarity = 'UNIQUE' AND c.campaign IS NULL;

  RETURN n;
END; $$;

REVOKE ALL ON FUNCTION public.fc_seed_catalog() FROM anon, authenticated, public;
SELECT public.fc_seed_catalog();