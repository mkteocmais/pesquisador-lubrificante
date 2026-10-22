-- 1) Cadastros de Empresas, Marcas e Produtos (de concorrentes) que alimentam
--    o autocompletar. Os administradores corrigem os nomes no Painel e a
--    correção vale também para os lançamentos já feitos.
-- 2) Volume da embalagem ("Bombona 20L" = 20, "Caixa 12x900ml" = 10,8), para
--    comparar preço por litro/quilo.
-- 3) Retorno de preço só entre produtos comparáveis: o mesmo equivalente
--    Evora (ou o mesmo produto do concorrente), sempre no mesmo fluxo de venda
--    e separado por estado, por embalagem e por litro.

-- ---------------------------------------------------------------------------
-- Volume da embalagem (litros ou quilos). Mesma regra de volumeDaEmbalagem()
-- em src/utils/options.ts: mude os dois juntos.
create or replace function public.volume_embalagem(p text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  t text := lower(replace(coalesce(p, ''), ',', '.'));
  m text[];
  qtd numeric := 1;
  txt text;
  num numeric;
  un text;
begin
  -- "12x1L", "100 x 80g", "40x1/2lt"
  m := regexp_match(t, '(\d+)\s*x\s*(\d+(?:\.\d+)?(?:/\d+)?)\s*(ml|litros?|lts?|l|kgs?|gr|g)\y');
  if m is not null then
    qtd := m[1]::numeric;
    txt := m[2];
    un := m[3];
  else
    m := regexp_match(t, '(\d+(?:\.\d+)?(?:/\d+)?)\s*(ml|litros?|lts?|l|kgs?|gr|g)\y');
    if m is null then
      return null;
    end if;
    txt := m[1];
    un := m[2];
  end if;
  if position('/' in txt) > 0 then
    num := split_part(txt, '/', 1)::numeric / nullif(split_part(txt, '/', 2)::numeric, 0);
  else
    num := txt::numeric;
  end if;
  if un in ('ml', 'g', 'gr') then
    num := num / 1000;
  end if;
  if num is null or num <= 0 then
    return null;
  end if;
  return round(qtd * num, 4);
end;
$$;

-- ---------------------------------------------------------------------------
-- Cadastros. "unido_a" guarda para onde foi um item unificado a outro;
-- "revisado" marca o que um administrador já conferiu.
create table if not exists public.cad_marcas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 120),
  ativo boolean not null default true,
  revisado boolean not null default false,
  unido_a uuid references public.cad_marcas(id),
  created_at timestamptz not null default now()
);
create unique index if not exists cad_marcas_chave_idx on public.cad_marcas ((public.chave_texto(nome))) where ativo;

create table if not exists public.cad_produtos (
  id uuid primary key default gen_random_uuid(),
  marca_id uuid not null references public.cad_marcas(id),
  nome text not null check (char_length(nome) between 1 and 200),
  viscosidade text,
  desempenho text,
  ativo boolean not null default true,
  revisado boolean not null default false,
  unido_a uuid references public.cad_produtos(id),
  created_at timestamptz not null default now()
);
create unique index if not exists cad_produtos_chave_idx on public.cad_produtos (marca_id, (public.chave_texto(nome))) where ativo;

create table if not exists public.cad_empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 200),
  cidade text,
  uf text check (uf is null or uf ~ '^[A-Z]{2}$'),
  ativo boolean not null default true,
  revisado boolean not null default false,
  unido_a uuid references public.cad_empresas(id),
  created_at timestamptz not null default now()
);
create unique index if not exists cad_empresas_chave_idx on public.cad_empresas
  ((public.chave_texto(nome)), (coalesce(public.chave_texto(cidade), '')), (coalesce(uf, ''))) where ativo;

alter table public.cad_marcas enable row level security;
alter table public.cad_produtos enable row level security;
alter table public.cad_empresas enable row level security;

-- Todos leem os itens ativos (para o autocompletar); o administrador vê
-- todos. Alterações só pelas funções admin_* abaixo, que também corrigem os
-- lançamentos.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cad_marcas' and policyname = 'Marcas: leitura') then
    create policy "Marcas: leitura" on public.cad_marcas
      for select to authenticated using (ativo or (select public.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cad_produtos' and policyname = 'Produtos concorrentes: leitura') then
    create policy "Produtos concorrentes: leitura" on public.cad_produtos
      for select to authenticated using (ativo or (select public.is_admin()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cad_empresas' and policyname = 'Empresas: leitura') then
    create policy "Empresas: leitura" on public.cad_empresas
      for select to authenticated using (ativo or (select public.is_admin()));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Carga inicial a partir dos lançamentos, com a grafia mais usada de cada nome.
insert into public.cad_marcas (nome)
select nome from (
  select trim(l.marca) as nome,
         row_number() over (partition by public.chave_texto(l.marca) order by count(*) desc, trim(l.marca)) as rn
    from public.lubricants l
   where public.chave_texto(l.marca) is not null
   group by trim(l.marca), public.chave_texto(l.marca)
) x
where rn = 1
on conflict ((public.chave_texto(nome))) where ativo do nothing;

insert into public.cad_produtos (marca_id, nome, viscosidade, desempenho)
select m.id, x.nome, x.viscosidade, x.desempenho
  from (
    select public.chave_texto(l.marca) as k_marca,
           trim(l.produto) as nome,
           row_number() over (partition by public.chave_texto(l.marca), public.chave_texto(l.produto)
                              order by count(*) desc, trim(l.produto)) as rn,
           (array_agg(trim(l.viscosidade) order by l.created_at desc) filter (where public.chave_texto(l.viscosidade) is not null))[1] as viscosidade,
           (array_agg(trim(l.desempenho) order by l.created_at desc) filter (where public.chave_texto(l.desempenho) is not null))[1] as desempenho
      from public.lubricants l
     where public.chave_texto(l.marca) is not null and public.chave_texto(l.produto) is not null
     group by public.chave_texto(l.marca), trim(l.produto), public.chave_texto(l.produto)
  ) x
  join public.cad_marcas m on m.ativo and public.chave_texto(m.nome) = x.k_marca
 where x.rn = 1
on conflict (marca_id, (public.chave_texto(nome))) where ativo do nothing;

insert into public.cad_empresas (nome, cidade, uf)
select nome, cidade, uf from (
  select trim(l.empresa) as nome,
         nullif(trim(l.cidade), '') as cidade,
         case when l.estado ~ '^[A-Z]{2}$' then l.estado end as uf,
         row_number() over (
           partition by public.chave_texto(l.empresa), coalesce(public.chave_texto(l.cidade), ''),
                        case when l.estado ~ '^[A-Z]{2}$' then l.estado end
           order by count(*) desc, trim(l.empresa)) as rn
    from public.lubricants l
   where public.chave_texto(l.empresa) is not null
   group by trim(l.empresa), public.chave_texto(l.empresa), nullif(trim(l.cidade), ''), public.chave_texto(l.cidade), l.estado
) x
where rn = 1
on conflict ((public.chave_texto(nome)), (coalesce(public.chave_texto(cidade), '')), (coalesce(uf, ''))) where ativo do nothing;

-- ---------------------------------------------------------------------------
-- Todo lançamento novo (ou corrigido) com marca, produto ou empresa que ainda
-- não está no cadastro entra como "não revisado", para o administrador conferir.
create or replace function public.registrar_cadastros()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_marca uuid;
begin
  if public.chave_texto(new.marca) is not null then
    select id into v_marca from public.cad_marcas where ativo and public.chave_texto(nome) = public.chave_texto(new.marca);
    if v_marca is null then
      insert into public.cad_marcas (nome) values (trim(new.marca))
      on conflict ((public.chave_texto(nome))) where ativo do nothing
      returning id into v_marca;
    end if;
    if v_marca is not null and public.chave_texto(new.produto) is not null then
      insert into public.cad_produtos (marca_id, nome, viscosidade, desempenho)
      values (v_marca, trim(new.produto), nullif(trim(new.viscosidade), ''), nullif(trim(new.desempenho), ''))
      on conflict (marca_id, (public.chave_texto(nome))) where ativo do nothing;
    end if;
  end if;
  if public.chave_texto(new.empresa) is not null then
    insert into public.cad_empresas (nome, cidade, uf)
    values (trim(new.empresa), nullif(trim(new.cidade), ''), case when new.estado ~ '^[A-Z]{2}$' then new.estado end)
    on conflict ((public.chave_texto(nome)), (coalesce(public.chave_texto(cidade), '')), (coalesce(uf, ''))) where ativo do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function public.registrar_cadastros() from public, anon, authenticated;

create or replace trigger lubricants_registrar_cadastros
  after insert or update of marca, produto, empresa, cidade, estado on public.lubricants
  for each row execute function public.registrar_cadastros();

-- Correção de nome feita pelo administrador não é "edição" do vendedor:
-- não mexe no updated_at ("corrigido em") dos lançamentos.
create or replace function public.lubricants_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('app.renomeando', true), '') <> 'on' then
    new.updated_at := now();
  end if;
  if not public.is_admin() then
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Funções do administrador. Salvar com um nome que já existe UNE os dois
-- itens: os lançamentos passam para o nome que ficou.

create or replace function public.admin_salvar_marca(p_id uuid, p_nome text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text := trim(coalesce(p_nome, ''));
  v_old public.cad_marcas;
  v_dest public.cad_marcas;
  r record;
  v_prod_dest uuid;
begin
  if not public.is_admin() then raise exception 'acesso negado'; end if;
  if public.chave_texto(v_nome) is null then raise exception 'nome inválido'; end if;
  perform set_config('app.renomeando', 'on', true);

  select * into v_dest from public.cad_marcas
   where ativo and public.chave_texto(nome) = public.chave_texto(v_nome) and id is distinct from p_id;

  if p_id is null then
    if v_dest.id is not null then
      update public.cad_marcas set revisado = true where id = v_dest.id;
      return v_dest.id;
    end if;
    insert into public.cad_marcas (nome, revisado) values (v_nome, true) returning id into v_dest.id;
    return v_dest.id;
  end if;

  select * into v_old from public.cad_marcas where id = p_id;
  if v_old.id is null then raise exception 'marca não encontrada'; end if;

  if v_dest.id is not null then
    -- Une: produtos da marca antiga vão para a marca que fica.
    for r in select * from public.cad_produtos where marca_id = v_old.id and ativo loop
      select id into v_prod_dest from public.cad_produtos
       where ativo and marca_id = v_dest.id and public.chave_texto(nome) = public.chave_texto(r.nome);
      if v_prod_dest is not null then
        update public.cad_produtos set ativo = false, unido_a = v_prod_dest where id = r.id;
      else
        update public.cad_produtos set marca_id = v_dest.id where id = r.id;
      end if;
    end loop;
    update public.cad_marcas set ativo = false, unido_a = v_dest.id where id = v_old.id;
    update public.cad_marcas set revisado = true where id = v_dest.id;
    update public.lubricants set marca = v_dest.nome
     where public.chave_texto(marca) = public.chave_texto(v_old.nome) and marca is distinct from v_dest.nome;
    return v_dest.id;
  end if;

  update public.cad_marcas set nome = v_nome, revisado = true where id = v_old.id;
  update public.lubricants set marca = v_nome
   where public.chave_texto(marca) = public.chave_texto(v_old.nome) and marca is distinct from v_nome;
  return v_old.id;
end;
$$;

create or replace function public.admin_salvar_produto(
  p_id uuid, p_marca_id uuid, p_nome text, p_viscosidade text, p_desempenho text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text := trim(coalesce(p_nome, ''));
  v_old public.cad_produtos;
  v_old_marca text;
  v_marca public.cad_marcas;
  v_dest public.cad_produtos;
begin
  if not public.is_admin() then raise exception 'acesso negado'; end if;
  if public.chave_texto(v_nome) is null then raise exception 'nome inválido'; end if;
  perform set_config('app.renomeando', 'on', true);

  if p_id is not null then
    select * into v_old from public.cad_produtos where id = p_id;
    if v_old.id is null then raise exception 'produto não encontrado'; end if;
    select nome into v_old_marca from public.cad_marcas where id = v_old.marca_id;
  end if;
  select * into v_marca from public.cad_marcas where id = coalesce(p_marca_id, v_old.marca_id) and ativo;
  if v_marca.id is null then raise exception 'marca não encontrada'; end if;

  select * into v_dest from public.cad_produtos
   where ativo and marca_id = v_marca.id and public.chave_texto(nome) = public.chave_texto(v_nome) and id is distinct from p_id;

  if p_id is null then
    if v_dest.id is not null then
      update public.cad_produtos
         set revisado = true,
             viscosidade = coalesce(nullif(trim(p_viscosidade), ''), viscosidade),
             desempenho = coalesce(nullif(trim(p_desempenho), ''), desempenho)
       where id = v_dest.id;
      return v_dest.id;
    end if;
    insert into public.cad_produtos (marca_id, nome, viscosidade, desempenho, revisado)
    values (v_marca.id, v_nome, nullif(trim(p_viscosidade), ''), nullif(trim(p_desempenho), ''), true)
    returning id into v_dest.id;
    return v_dest.id;
  end if;

  if v_dest.id is not null then
    update public.cad_produtos set ativo = false, unido_a = v_dest.id where id = v_old.id;
    update public.cad_produtos set revisado = true where id = v_dest.id;
    update public.lubricants set produto = v_dest.nome, marca = v_marca.nome
     where public.chave_texto(marca) = public.chave_texto(v_old_marca)
       and public.chave_texto(produto) = public.chave_texto(v_old.nome);
    return v_dest.id;
  end if;

  update public.cad_produtos
     set nome = v_nome, marca_id = v_marca.id,
         viscosidade = nullif(trim(p_viscosidade), ''), desempenho = nullif(trim(p_desempenho), ''),
         revisado = true
   where id = v_old.id;
  update public.lubricants set produto = v_nome, marca = v_marca.nome
   where public.chave_texto(marca) = public.chave_texto(v_old_marca)
     and public.chave_texto(produto) = public.chave_texto(v_old.nome)
     and (produto is distinct from v_nome or marca is distinct from v_marca.nome);
  return v_old.id;
end;
$$;

create or replace function public.admin_salvar_empresa(p_id uuid, p_nome text, p_cidade text, p_uf text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text := trim(coalesce(p_nome, ''));
  v_cidade text := nullif(trim(coalesce(p_cidade, '')), '');
  v_uf text := nullif(upper(trim(coalesce(p_uf, ''))), '');
  v_old public.cad_empresas;
  v_dest public.cad_empresas;
begin
  if not public.is_admin() then raise exception 'acesso negado'; end if;
  if public.chave_texto(v_nome) is null then raise exception 'nome inválido'; end if;
  perform set_config('app.renomeando', 'on', true);

  select * into v_dest from public.cad_empresas
   where ativo and public.chave_texto(nome) = public.chave_texto(v_nome)
     and coalesce(public.chave_texto(cidade), '') = coalesce(public.chave_texto(v_cidade), '')
     and coalesce(uf, '') = coalesce(v_uf, '')
     and id is distinct from p_id;

  if p_id is null then
    if v_dest.id is not null then
      update public.cad_empresas set revisado = true where id = v_dest.id;
      return v_dest.id;
    end if;
    insert into public.cad_empresas (nome, cidade, uf, revisado) values (v_nome, v_cidade, v_uf, true)
    returning id into v_dest.id;
    return v_dest.id;
  end if;

  select * into v_old from public.cad_empresas where id = p_id;
  if v_old.id is null then raise exception 'empresa não encontrada'; end if;

  if v_dest.id is not null then
    update public.cad_empresas set ativo = false, unido_a = v_dest.id where id = v_old.id;
    update public.cad_empresas set revisado = true where id = v_dest.id;
  else
    update public.cad_empresas set nome = v_nome, cidade = v_cidade, uf = v_uf, revisado = true where id = v_old.id;
  end if;

  update public.lubricants
     set empresa = coalesce(v_dest.nome, v_nome),
         cidade = coalesce(v_dest.cidade, v_cidade),
         estado = coalesce(v_dest.uf, v_uf, estado)
   where public.chave_texto(empresa) = public.chave_texto(v_old.nome)
     and coalesce(public.chave_texto(cidade), '') = coalesce(public.chave_texto(v_old.cidade), '')
     and coalesce(estado, '') = coalesce(v_old.uf, '');
  return coalesce(v_dest.id, v_old.id);
end;
$$;

-- Arquivar (sai do autocompletar, os lançamentos ficam como estão) e marcar
-- como revisado.
create or replace function public.admin_status_cadastro(p_tipo text, p_id uuid, p_ativo boolean, p_revisado boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'acesso negado'; end if;
  if p_tipo = 'marca' then
    update public.cad_marcas set ativo = coalesce(p_ativo, ativo), revisado = coalesce(p_revisado, revisado) where id = p_id;
  elsif p_tipo = 'produto' then
    update public.cad_produtos set ativo = coalesce(p_ativo, ativo), revisado = coalesce(p_revisado, revisado) where id = p_id;
  elsif p_tipo = 'empresa' then
    update public.cad_empresas set ativo = coalesce(p_ativo, ativo), revisado = coalesce(p_revisado, revisado) where id = p_id;
  else
    raise exception 'tipo inválido';
  end if;
end;
$$;

revoke execute on function public.admin_salvar_marca(uuid, text) from public, anon;
revoke execute on function public.admin_salvar_produto(uuid, uuid, text, text, text) from public, anon;
revoke execute on function public.admin_salvar_empresa(uuid, text, text, text) from public, anon;
revoke execute on function public.admin_status_cadastro(text, uuid, boolean, boolean) from public, anon;
grant execute on function public.admin_salvar_marca(uuid, text) to authenticated;
grant execute on function public.admin_salvar_produto(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.admin_salvar_empresa(uuid, text, text, text) to authenticated;
grant execute on function public.admin_status_cadastro(text, uuid, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Retorno de preço. Só compara o que é comparável:
--   * mesmo equivalente Evora (ex: todos ligados à EVORA HD - ISO 68), ou o
--     mesmo produto do concorrente (marca + nome);
--   * sempre o mesmo fluxo de venda (Fábrica -> Distribuidor não se mistura
--     com Distribuidor -> Revenda);
--   * por embalagem (mesmo SKU) e por litro/quilo (qualquer SKU);
--   * no estado e no Brasil.
-- Com menos de 3 pesquisas devolve só a contagem (não expõe o preço de um
-- único lançamento de outro vendedor).
create or replace function public._estatistica_recorte(
  p_excluir uuid, p_ref uuid, p_marca text, p_produto text,
  p_sku text, p_cliente text, p_estado text, p_por_litro boolean
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with recorte as (
    select case when p_por_litro then l.preco / public.volume_embalagem(l.sku) else l.preco end as valor
      from public.lubricants l
     where l.id <> p_excluir
       and l.preco > 0
       and l.created_at > now() - interval '12 months'
       and (case when p_ref is not null then l.produto_ref_id = p_ref
                 else public.chave_texto(l.marca) = public.chave_texto(p_marca)
                      and public.chave_texto(l.produto) = public.chave_texto(p_produto) end)
       and coalesce(l.cliente, '') = coalesce(p_cliente, '')
       and (p_estado is null or l.estado = p_estado)
       and (case when p_por_litro then coalesce(public.volume_embalagem(l.sku), 0) > 0
                 else public.chave_texto(l.sku) is not distinct from public.chave_texto(p_sku) end)
  )
  select case
    when count(*) < 3 then jsonb_build_object('n', count(*))
    else jsonb_build_object(
      'n', count(*),
      'mediana', round((percentile_cont(0.5) within group (order by valor))::numeric, 2),
      'minimo', round(min(valor), 2),
      'maximo', round(max(valor), 2))
  end
  from recorte;
$$;

revoke execute on function public._estatistica_recorte(uuid, uuid, text, text, text, text, text, boolean) from public, anon, authenticated;

create or replace function public.devolutiva_preco(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.lubricants;
  v_vol numeric;
  v_mesmo jsonb;
  v_equiv jsonb;
begin
  select * into r from public.lubricants where id = p_id;
  if not found or not (r.user_id = (select auth.uid()) or public.is_admin()) then
    return null;
  end if;
  v_vol := public.volume_embalagem(r.sku);

  if r.produto_ref_id is not null then
    v_equiv := jsonb_build_object(
      'sku', jsonb_build_object(
        'estado', case when r.estado is null then null
                       else public._estatistica_recorte(r.id, r.produto_ref_id, null, null, r.sku, r.cliente, r.estado, false) end,
        'brasil', public._estatistica_recorte(r.id, r.produto_ref_id, null, null, r.sku, r.cliente, null, false)),
      'litro', case when v_vol is null then null else jsonb_build_object(
        'estado', case when r.estado is null then null
                       else public._estatistica_recorte(r.id, r.produto_ref_id, null, null, r.sku, r.cliente, r.estado, true) end,
        'brasil', public._estatistica_recorte(r.id, r.produto_ref_id, null, null, r.sku, r.cliente, null, true)) end);
  end if;

  if public.chave_texto(r.marca) is not null and public.chave_texto(r.produto) is not null then
    v_mesmo := jsonb_build_object(
      'sku', jsonb_build_object(
        'estado', case when r.estado is null then null
                       else public._estatistica_recorte(r.id, null, r.marca, r.produto, r.sku, r.cliente, r.estado, false) end,
        'brasil', public._estatistica_recorte(r.id, null, r.marca, r.produto, r.sku, r.cliente, null, false)),
      'litro', case when v_vol is null then null else jsonb_build_object(
        'estado', case when r.estado is null then null
                       else public._estatistica_recorte(r.id, null, r.marca, r.produto, r.sku, r.cliente, r.estado, true) end,
        'brasil', public._estatistica_recorte(r.id, null, r.marca, r.produto, r.sku, r.cliente, null, true)) end);
  end if;

  return jsonb_build_object(
    'preco', r.preco,
    'volume', v_vol,
    'equivalente', v_equiv,
    'mesmo_produto', v_mesmo
  );
end;
$$;

revoke execute on function public.devolutiva_preco(uuid) from public, anon;
grant execute on function public.devolutiva_preco(uuid) to authenticated;
