-- Lançamentos de preço (tabela "lubricants", a mesma do app antigo) passam a
-- pertencer ao vendedor logado e a apontar para o nosso produto equivalente.
--
-- Esta migração é só ADITIVA: as policies anônimas do app antigo continuam
-- valendo até a troca de versão (ver supabase/pendentes/desliga_acesso_anonimo.sql,
-- que só deve ser aplicada depois que o app novo estiver no ar).

alter table public.lubricants
  add column if not exists user_id uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists produto_ref_id uuid references public.produtos(id) on delete set null,
  add column if not exists updated_at timestamptz,
  -- Valores como o vendedor digitou, guardados quando a limpeza de dados os padronizou.
  add column if not exists dados_originais jsonb;

create index if not exists lubricants_user_idx on public.lubricants (user_id);
create index if not exists lubricants_produto_ref_idx on public.lubricants (produto_ref_id);
create index if not exists lubricants_created_idx on public.lubricants (created_at desc);

-- Validação no servidor. A faixa aceita 0 porque há um lançamento antigo
-- zerado; preço maior que zero é exigido na policy de criação. Os tamanhos de
-- texto são NOT VALID: valem para o que entra daqui pra frente.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lubricants_preco_faixa') then
    alter table public.lubricants add constraint lubricants_preco_faixa
      check (preco is null or (preco >= 0 and preco < 10000000));
  end if;
end $$;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lubricants_textos_tamanho') then
    alter table public.lubricants add constraint lubricants_textos_tamanho
      check (
        char_length(coalesce(empresa, '')) <= 200 and char_length(coalesce(marca, '')) <= 120
        and char_length(coalesce(produto, '')) <= 200 and char_length(coalesce(colaborador, '')) <= 120
        and char_length(coalesce(cidade, '')) <= 120 and char_length(coalesce(sku, '')) <= 80
        and char_length(coalesce(viscosidade, '')) <= 60 and char_length(coalesce(cliente, '')) <= 80
      ) not valid;
  end if;
end $$;

-- Mantém updated_at e impede que uma edição troque o dono do lançamento.
create or replace function public.lubricants_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if not public.is_admin() then
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create or replace trigger lubricants_before_update
  before update on public.lubricants
  for each row execute function public.lubricants_before_update();

-- Vendedor: vê, cria, corrige e apaga só os próprios lançamentos.
-- Administrador: vê e corrige todos (inclusive os antigos, sem dono).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lubricants' and policyname = 'Lançamentos: leitura') then
    create policy "Lançamentos: leitura" on public.lubricants
      for select to authenticated
      using (user_id = (select auth.uid()) or (select public.is_admin()));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lubricants' and policyname = 'Lançamentos: criar') then
    create policy "Lançamentos: criar" on public.lubricants
      for insert to authenticated
      with check (user_id = (select auth.uid()) and preco > 0 and (select public.is_ativo()));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lubricants' and policyname = 'Lançamentos: corrigir') then
    create policy "Lançamentos: corrigir" on public.lubricants
      for update to authenticated
      using ((user_id = (select auth.uid()) and (select public.is_ativo())) or (select public.is_admin()))
      with check ((user_id = (select auth.uid()) and (select public.is_ativo())) or (select public.is_admin()));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lubricants' and policyname = 'Lançamentos: apagar') then
    create policy "Lançamentos: apagar" on public.lubricants
      for delete to authenticated
      using ((user_id = (select auth.uid()) and (select public.is_ativo())) or (select public.is_admin()));
  end if;
end $$;

-- Fotos: o vendedor logado envia para a pasta com o próprio id.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Fotos: vendedor envia') then
    create policy "Fotos: vendedor envia" on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'fotos-lubrificantes'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
end $$;
