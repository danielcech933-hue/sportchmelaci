alter table public.matches
  add column if not exists match_format text not null default '1v1',
  add column if not exists team_a_players jsonb not null default '[]'::jsonb,
  add column if not exists team_b_players jsonb not null default '[]'::jsonb;

alter table public.matches drop constraint if exists matches_match_format_check;
alter table public.matches add constraint matches_match_format_check check (match_format in ('1v1','2v2'));

create or replace function public.validate_match_lineups()
returns trigger language plpgsql security definer set search_path=public as $function$
declare
  a jsonb := coalesce(new.team_a_players,'[]'::jsonb);
  b jsonb := coalesce(new.team_b_players,'[]'::jsonb);
begin
  if jsonb_typeof(a) <> 'array' or jsonb_typeof(b) <> 'array' then raise exception 'invalid_team_players'; end if;
  if jsonb_array_length(a)=0 then a:=to_jsonb(regexp_split_to_array(trim(new.team_a), E'\\s*(?:&|/|,|\\+)\\s*')); end if;
  if jsonb_array_length(b)=0 then b:=to_jsonb(regexp_split_to_array(trim(new.team_b), E'\\s*(?:&|/|,|\\+)\\s*')); end if;
  if new.match_format='1v1' and (jsonb_array_length(a)<>1 or jsonb_array_length(b)<>1) then raise exception '1v1_requires_one_player_per_side'; end if;
  if new.match_format='2v2' and (jsonb_array_length(a)<>2 or jsonb_array_length(b)<>2) then raise exception '2v2_requires_two_players_per_side'; end if;
  if exists(select 1 from jsonb_array_elements_text(a) x where trim(x)='') or exists(select 1 from jsonb_array_elements_text(b) x where trim(x)='') then raise exception 'empty_player'; end if;
  if (select count(*) from (select lower(trim(x)) name from jsonb_array_elements_text(a) x union all select lower(trim(x)) name from jsonb_array_elements_text(b) x) q) <> (select count(distinct name) from (select lower(trim(x)) name from jsonb_array_elements_text(a) x union all select lower(trim(x)) name from jsonb_array_elements_text(b) x) q2) then raise exception 'duplicate_player_across_sides'; end if;
  new.team_a_players:=a;
  new.team_b_players:=b;
  new.team_a:=array_to_string(array(select jsonb_array_elements_text(a)),' & ');
  new.team_b:=array_to_string(array(select jsonb_array_elements_text(b)),' & ');
  return new;
end;
$function$;

drop trigger if exists validate_match_lineups_trg on public.matches;
create trigger validate_match_lineups_trg
before insert or update of match_format,team_a_players,team_b_players,team_a,team_b on public.matches
for each row execute function public.validate_match_lineups();

create or replace function public.sync_match_elo(_match_id uuid)
returns void language plpgsql security definer set search_path=public as $function$
declare
  m record; winner text; sets_a int; sets_b int; ids_a uuid[]; ids_b uuid[]; avg_a numeric; avg_b numeric; exp_a numeric; delta int; u uuid; names_a text[]; names_b text[];
begin
  if auth.uid() is not null and not public.has_role(auth.uid(),'admin') then raise exception 'not_admin'; end if;
  select * into m from public.matches where id=_match_id;
  if m.id is null or m.ended_at is null or m.confirmed_at is null then return; end if;
  if m.score_a > m.score_b then winner:='a'; elsif m.score_b > m.score_a then winner:='b'; else
    select count(*) into sets_a from jsonb_array_elements(coalesce(m.sets,'[]'::jsonb)) s where (s->>'a')::int>(s->>'b')::int;
    select count(*) into sets_b from jsonb_array_elements(coalesce(m.sets,'[]'::jsonb)) s where (s->>'b')::int>(s->>'a')::int;
    if sets_a>sets_b then winner:='a'; elsif sets_b>sets_a then winner:='b'; else return; end if;
  end if;
  if coalesce(jsonb_array_length(m.team_a_players),0)>0 then select array_agg(lower(trim(x))) into names_a from jsonb_array_elements_text(m.team_a_players) x; else select array_agg(lower(trim(x))) into names_a from regexp_split_to_table(m.team_a,'\\s*(?:&|/|,|\\+)\\s*') x; end if;
  if coalesce(jsonb_array_length(m.team_b_players),0)>0 then select array_agg(lower(trim(x))) into names_b from jsonb_array_elements_text(m.team_b_players) x; else select array_agg(lower(trim(x))) into names_b from regexp_split_to_table(m.team_b,'\\s*(?:&|/|,|\\+)\\s*') x; end if;
  select coalesce(array_agg(p.id),array[]::uuid[]) into ids_a from public.profiles p where lower(p.nickname)=any(names_a);
  select coalesce(array_agg(p.id),array[]::uuid[]) into ids_b from public.profiles p where lower(p.nickname)=any(names_b);
  if array_length(ids_a,1) is null or array_length(ids_b,1) is null then return; end if;
  select avg(elo) into avg_a from public.profiles where id=any(ids_a); select avg(elo) into avg_b from public.profiles where id=any(ids_b);
  exp_a:=1.0/(1.0+power(10.0,(avg_b-avg_a)/400.0));
  if winner='a' then delta:=greatest(5,round(32*(1-exp_a))::int); else delta:=greatest(5,round(32*exp_a)::int); end if;
  if winner='a' then
    update public.profiles set elo=elo+delta where id=any(ids_a); update public.profiles set elo=greatest(100,elo-delta) where id=any(ids_b);
    foreach u in array ids_a loop perform public.notify_win(u,'match_win','🏆 Výhra: '||m.team_a||' vs '||m.team_b,to_char(coalesce(m.ended_at,now()) at time zone 'Europe/Prague','DD.MM.YYYY HH24:MI')||' • '||m.score_a||':'||m.score_b||' • +'||delta||' ELO'); end loop;
  else
    update public.profiles set elo=elo+delta where id=any(ids_b); update public.profiles set elo=greatest(100,elo-delta) where id=any(ids_a);
    foreach u in array ids_b loop perform public.notify_win(u,'match_win','🏆 Výhra: '||m.team_b||' vs '||m.team_a,to_char(coalesce(m.ended_at,now()) at time zone 'Europe/Prague','DD.MM.YYYY HH24:MI')||' • '||m.score_b||':'||m.score_a||' • +'||delta||' ELO'); end loop;
  end if;
end;
$function$;

create or replace function public.case_opening_stock_open(_case_id text)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare uid uuid:=auth.uid(); nick text; bal numeric; c record; co record; roll numeric; shares bigint; scarcity int; score int; rarity text; serial text; next_bal numeric;
begin
 if uid is null then raise exception 'not_authenticated'; end if;
 select p.nickname,p.balance into nick,bal from public.profiles p where p.id=uid for update;
 if bal is null then raise exception 'no_profile'; end if;
 if lower(trim(coalesce(nick,''))) not in ('danko','chlaďar','chladar','midas','m1das') then raise exception 'case_opening_forbidden'; end if;
 select * into c from public.case_opening_stock_cases where id=lower(trim(_case_id)) and active=true; if c.id is null then raise exception 'invalid_case'; end if;
 if bal<c.cost then raise exception 'insufficient_balance'; end if;
 if c.sector in ('Global','Omega') then select * into co from public.case_opening_stock_companies order by power(random(),1.0/(company_tier+1)) desc limit 1;
 elsif c.sector='AI & Cloud' then select * into co from public.case_opening_stock_companies where sector in ('AI & Cloud','Technology') order by power(random(),1.0/(company_tier+1)) desc limit 1;
 else select * into co from public.case_opening_stock_companies where sector=c.sector order by power(random(),1.0/(company_tier+1)) desc limit 1; end if;
 if co.id is null then raise exception 'no_drop_pool'; end if; roll=random();
 if c.id='omega' then shares:=case when roll<0.04 then 1 when roll<0.16 then 2+floor(random()*9)::bigint when roll<0.42 then 10+floor(random()*41)::bigint when roll<0.72 then 50+floor(random()*451)::bigint else 500+floor(random()*4501)::bigint end;
 else shares:=case when roll<0.06 then 1+floor(random()*24)::bigint when roll<0.20 then 25+floor(random()*76)::bigint when roll<0.48 then 100+floor(random()*901)::bigint when roll<0.78 then 1000+floor(random()*9001)::bigint else 10000+floor(random()*990001)::bigint end; end if;
 scarcity:=case when shares<=5 then 60 when shares<=25 then 50 when shares<=100 then 40 when shares<=1000 then 30 when shares<=10000 then 20 when shares<=100000 then 10 else 0 end; score:=co.company_tier*10+scarcity;
 rarity:=case when score>=110 then 'MYTHIC' when score>=90 then 'ULTRA' when score>=70 then 'LEGENDARY' when score>=55 then 'EPIC' when score>=40 then 'RARE' when score>=25 then 'UNCOMMON' else 'COMMON' end;
 serial:='STK-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))||'-'||upper(substr(md5(uid::text||clock_timestamp()::text||co.ticker),1,8)); next_bal:=round(bal-c.cost,2);
 update public.profiles set balance=next_bal,updated_at=now() where id=uid;
 insert into public.case_opening_stock_inventory(user_id,case_id,company_id,company_name,ticker,sector,share_count,rarity,rarity_score,serial) values(uid,c.id,co.id,co.company_name,co.ticker,co.sector,shares,rarity,score,serial);
 insert into public.case_opening_stock_history(user_id,case_id,case_cost,company_name,ticker,sector,share_count,rarity,rarity_score,serial) values(uid,c.id,c.cost,co.company_name,co.ticker,co.sector,shares,rarity,score,serial);
 return jsonb_build_object('case_id',c.id,'case_name',c.name,'cost',c.cost,'company_name',co.company_name,'ticker',co.ticker,'sector',co.sector,'share_count',shares,'rarity',rarity,'rarity_score',score,'serial',serial,'balance',next_bal,'virtual_only',true);
end;
$function$;
