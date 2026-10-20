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
alter table public.lubricants drop constraint if exists lubricants_preco_faixa;
alter table public.lubricants add constraint lubricants_preco_faixa
  check (preco is null or (preco >= 0 and preco < 10000000));
alter table public.lubricants drop constraint if exists lubricants_textos_tamanho;
alter table public.lubricants add constraint lubricants_textos_tamanho
  check (
    char_length(coalesce(empresa, '')) <= 200 and char_length(coalesce(marca, '')) <= 120
    and char_length(coalesce(produto, '')) <= 200 and char_length(coalesce(colaborador, '')) <= 120
    and char_length(coalesce(cidade, '')) <= 120 and char_length(coalesce(sku, '')) <= 80
    and char_length(coalesce(viscosidade, '')) <= 60 and char_length(coalesce(cliente, '')) <= 80
  ) not valid;

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

drop trigger if exists lubricants_before_update on public.lubricants;
create trigger lubricants_before_update
  before update on public.lubricants
  for each row execute function public.lubricants_before_update();

-- Vendedor: vê, cria, corrige e apaga só os próprios lançamentos.
-- Administrador: vê e corrige todos (inclusive os antigos, sem dono).
drop policy if exists "Lançamentos: leitura" on public.lubricants;
create policy "Lançamentos: leitura" on public.lubricants
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Lançamentos: criar" on public.lubricants;
create policy "Lançamentos: criar" on public.lubricants
  for insert to authenticated
  with check (user_id = (select auth.uid()) and preco > 0 and (select public.is_ativo()));

drop policy if exists "Lançamentos: corrigir" on public.lubricants;
create policy "Lançamentos: corrigir" on public.lubricants
  for update to authenticated
  using ((user_id = (select auth.uid()) and (select public.is_ativo())) or (select public.is_admin()))
  with check ((user_id = (select auth.uid()) and (select public.is_ativo())) or (select public.is_admin()));

drop policy if exists "Lançamentos: apagar" on public.lubricants;
create policy "Lançamentos: apagar" on public.lubricants
  for delete to authenticated
  using ((user_id = (select auth.uid()) and (select public.is_ativo())) or (select public.is_admin()));

-- Fotos: o vendedor logado envia para a pasta com o próprio id.
drop policy if exists "Fotos: vendedor envia" on storage.objects;
create policy "Fotos: vendedor envia" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos-lubrificantes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
