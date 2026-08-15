create or replace function public.slot_variant_spin(_game_id text, _bet integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_game text := lower(trim(coalesce(_game_id, '')));
  v_bet integer := coalesce(_bet, 0);
  v_cols integer;
  v_rows integer;
  v_symbols text[];
  v_grid jsonb := '[]'::jsonb;
  v_col jsonb;
  v_sym text;
  v_r integer;
  v_c integer;
  v_total integer := 0;
  v_mult numeric := 0;
  v_feature text := 'BASE';
  v_boost integer := 1;
  v_count integer := 0;
  v_run integer;
  v_best_run integer := 0;
  v_line integer;
  v_line_sym text;
  v_line_count integer;
  v_trophy integer := 0;
  v_wild integer := 0;
  v_mystery integer := 0;
  v_result jsonb;
  v_slot_czk numeric;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_bet < 1 or v_bet > 5000 then
    raise exception 'invalid_slot_bet';
  end if;
  if v_game not in ('neon-pints','hop-highway','golden-chmel','cursed-kegs','stadium-legends') then
    raise exception 'invalid_slot_game';
  end if;

  case v_game
    when 'neon-pints' then
      v_cols := 6; v_rows := 5;
      v_symbols := array['pint','bolt','neon','ball','star','k','q','j','ten'];
    when 'hop-highway' then
      v_cols := 5; v_rows := 3;
      v_symbols := array['helmet','car','flag','boost','ball','k','q','j','ten'];
    when 'golden-chmel' then
      v_cols := 5; v_rows := 3;
      v_symbols := array['trophy_gold','trophy_silver','diamond','ball','whistle','k','q','j','ten'];
    when 'cursed-kegs' then
      v_cols := 6; v_rows := 4;
      v_symbols := array['cursed_keg','wild','skull','chain','ball','k','q','j','ten'];
    else
      v_cols := 5; v_rows := 4;
      v_symbols := array['legend','trophy_gold','wild','ball','boot','k','q','j','ten'];
  end case;

  for v_c in 1..v_cols loop
    v_col := '[]'::jsonb;
    for v_r in 1..v_rows loop
      v_sym := v_symbols[1 + floor(random() * array_length(v_symbols, 1))::int];
      if v_game = 'hop-highway' and random() < 0.13 then v_sym := 'boost'; end if;
      if v_game = 'cursed-kegs' and random() < 0.10 then v_sym := 'wild'; end if;
      if v_game = 'cursed-kegs' and random() < 0.10 then v_sym := 'cursed_keg'; end if;
      if v_game = 'stadium-legends' and random() < 0.08 then v_sym := 'wild'; end if;
      v_col := v_col || jsonb_build_array(v_sym);
      if v_sym = 'trophy_gold' then v_trophy := v_trophy + 1; end if;
      if v_sym = 'wild' then v_wild := v_wild + 1; end if;
      if v_sym = 'cursed_keg' then v_mystery := v_mystery + 1; end if;
    end loop;
    v_grid := v_grid || jsonb_build_array(v_col);
  end loop;

  if v_game = 'neon-pints' then
    -- Cluster-style math: large symbol populations reward more aggressively.
    foreach v_line_sym in array v_symbols loop
      select count(*) into v_count
      from jsonb_array_elements(v_grid) as col,
           jsonb_array_elements_text(col) as cell
      where cell = v_line_sym;
      if v_count >= 8 then v_total := v_total + v_bet * 12;
      elsif v_count >= 6 then v_total := v_total + v_bet * 6;
      elsif v_count >= 5 then v_total := v_total + v_bet * 3;
      end if;
    end loop;
    if v_total > 0 then v_feature := 'CASCADE'; end if;

  elsif v_game = 'hop-highway' then
    -- Ways-style left-to-right runs on the first three symbols of each row.
    for v_r in 0..v_rows-1 loop
      v_line_sym := (v_grid->0->>v_r);
      v_run := 0;
      for v_c in 0..v_cols-1 loop
        exit when (v_grid->v_c->>v_r) <> v_line_sym and (v_grid->v_c->>v_r) <> 'boost';
        v_run := v_run + 1;
      end loop;
      if v_run > v_best_run then v_best_run := v_run; end if;
      if v_run >= 3 then v_total := v_total + v_bet * v_run; end if;
    end loop;
    v_boost := greatest(1, least(4, 1 + (select count(*) from jsonb_array_elements(v_grid) as col, jsonb_array_elements_text(col) as cell where cell='boost') / 3));
    v_total := v_total * v_boost;
    if v_boost > 1 then v_feature := 'BOOST x' || v_boost; end if;

  elsif v_game = 'golden-chmel' then
    -- Three classic horizontal lines; gold trophies multiply the win.
    for v_line in 0..2 loop
      v_line_sym := v_grid->0->>v_line;
      v_line_count := 0;
      for v_c in 0..4 loop
        exit when (v_grid->v_c->>v_line) <> v_line_sym;
        v_line_count := v_line_count + 1;
      end loop;
      if v_line_count >= 3 then v_total := v_total + v_bet * (v_line_count - 1); end if;
    end loop;
    if v_trophy >= 2 then
      v_total := v_total * 2;
      v_feature := 'GOLDEN FRENZY';
    end if;

  elsif v_game = 'cursed-kegs' then
    -- Mystery and wild chain mode.
    v_count := v_wild + v_mystery;
    if v_count >= 5 then v_total := v_bet * 18;
    elsif v_count >= 4 then v_total := v_bet * 8;
    elsif v_count >= 3 then v_total := v_bet * 4;
    end if;
    if v_mystery >= 2 then
      v_total := greatest(v_total, v_bet * 5);
      v_feature := 'MYSTERY CHAIN';
    end if;
    if v_wild >= 3 then
      v_total := greatest(v_total, v_bet * 6);
      v_feature := 'CURSED WILD';
    end if;

  else
    -- Hall-of-fame line scoring with an extra sticky-style wild reward.
    for v_line in 0..3 loop
      v_line_sym := v_grid->0->>v_line;
      v_line_count := 0;
      for v_c in 0..4 loop
        exit when (v_grid->v_c->>v_line) <> v_line_sym and (v_grid->v_c->>v_line) <> 'wild';
        v_line_count := v_line_count + 1;
      end loop;
      if v_line_count >= 3 then v_total := v_total + v_bet * (v_line_count - 1); end if;
    end loop;
    if v_wild >= 2 then
      v_total := greatest(v_total, v_bet * 5);
      v_feature := 'LEGEND MULTIPLIER';
    end if;
  end if;

  v_total := greatest(0, least(v_total, v_bet * 100));
  v_mult := case when v_bet > 0 then round(v_total::numeric / v_bet, 2) else 0 end;

  -- Single authoritative wallet movement: wager out, payout back in.
  perform public.wallet_apply(
    _delta_dollars := 0,
    _delta_slot_czk := v_total - v_bet,
    _reason := 'slot_variant:' || v_game
  );

  select coalesce(slot_czk, 0) into v_slot_czk from public.profiles where id = v_uid;

  return jsonb_build_object(
    'game_id', v_game,
    'grid', v_grid,
    'columns', v_cols,
    'rows', v_rows,
    'total', v_total,
    'multiplier_of_bet', v_mult,
    'feature', v_feature,
    'slot_czk', v_slot_czk
  );
end;
$$;

revoke all on function public.slot_variant_spin(text, integer) from public;
grant execute on function public.slot_variant_spin(text, integer) to authenticated;
