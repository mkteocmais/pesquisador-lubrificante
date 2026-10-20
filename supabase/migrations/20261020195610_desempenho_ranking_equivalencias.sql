-- Campo "Desempenho" (especificações do produto do concorrente, ex: API SP,
-- ACEA C3, DEXOS 1 Gen 3), ranking de envios e base de equivalências para
-- todos os vendedores. Nenhuma destas funções devolve preço: vendedor não
-- baixa preços, só o administrador.

alter table public.lubricants add column if not exists desempenho text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lubricants_desempenho_tamanho') then
    alter table public.lubricants add constraint lubricants_desempenho_tamanho
      check (char_length(coalesce(desempenho, '')) <= 200) not valid;
  end if;
end $$;

-- Ranking de quem mais enviou preços. Lançamentos antigos (sem login) contam
-- pelo nome digitado até o administrador atribuí-los a um vendedor.
-- p_desde nulo = desde sempre.
create or replace function public.ranking_envios(p_desde timestamptz default null)
returns table (vendedor text, envios bigint, eu boolean)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(trim(p.nome), ''), split_part(p.email, '@', 1), nullif(trim(l.colaborador), '')) as vendedor,
         count(*) as envios,
         coalesce(bool_or(l.user_id = (select auth.uid())), false) as eu
    from public.lubricants l
    left join public.profiles p on p.id = l.user_id
   where public.is_ativo()
     and (p_desde is null or l.created_at >= p_desde)
   group by 1
  having coalesce(nullif(trim(p.nome), ''), split_part(p.email, '@', 1), nullif(trim(l.colaborador), '')) is not null
   order by 2 desc, 1;
$$;

-- Base de equivalências (concorrente -> nosso produto) sem preço nem autor.
create or replace function public.base_equivalencias()
returns table (marca text, produto text, viscosidade text, produto_id uuid, usos bigint, ultimo timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select min(trim(l.marca)), min(trim(l.produto)), min(trim(l.viscosidade)), l.produto_ref_id, count(*), max(l.created_at)
    from public.lubricants l
   where public.is_ativo()
     and l.produto_ref_id is not null
     and public.chave_texto(l.marca) is not null
   group by public.chave_texto(l.marca), public.chave_texto(l.produto), l.produto_ref_id
   order by count(*) desc;
$$;

revoke execute on function public.ranking_envios(timestamptz) from public, anon;
revoke execute on function public.base_equivalencias() from public, anon;
grant execute on function public.ranking_envios(timestamptz) to authenticated;
grant execute on function public.base_equivalencias() to authenticated;
