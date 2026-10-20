-- Catálogo dos nossos produtos (Grupo Pax), vindo da planilha
-- "Mapeamento Produtos Pesquisa". O vendedor liga o produto do concorrente a
-- um item daqui (ex: Lubrax Essencial 15W40 CI-4 -> Evora Extreme Active 15W40).
--
-- produtos     = linha comercial (o que se compara com o concorrente)
-- produto_skus = cada código SAP/embalagem daquela linha

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique check (char_length(nome) between 1 and 200),
  tipo text,
  viscosidade text,
  especificacao text,
  base text,
  aplicacao text,
  -- true quando ao menos um SKU está Ativo, em Phase Out ou é vendido a granel.
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.produto_skus (
  cod_sap text primary key,
  produto_id uuid not null references public.produtos(id) on delete cascade,
  descricao text,
  embalagem text,
  status text
);

create index if not exists produto_skus_produto_idx on public.produto_skus (produto_id);

alter table public.produtos enable row level security;
alter table public.produto_skus enable row level security;

-- Todo usuário logado consulta o catálogo; só o administrador altera.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'produtos' and policyname = 'Produtos: leitura') then
    create policy "Produtos: leitura" on public.produtos
      for select to authenticated using (true);
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'produtos' and policyname = 'Produtos: admin altera') then
    create policy "Produtos: admin altera" on public.produtos
      for all to authenticated
      using ((select public.is_admin())) with check ((select public.is_admin()));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'produto_skus' and policyname = 'SKUs: leitura') then
    create policy "SKUs: leitura" on public.produto_skus
      for select to authenticated using (true);
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'produto_skus' and policyname = 'SKUs: admin altera') then
    create policy "SKUs: admin altera" on public.produto_skus
      for all to authenticated
      using ((select public.is_admin())) with check ((select public.is_admin()));
  end if;
end $$;
