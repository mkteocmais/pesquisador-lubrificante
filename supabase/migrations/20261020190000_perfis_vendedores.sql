-- Perfis dos vendedores e administradores.
-- Os logins são criados à mão no painel do Supabase (Authentication > Users);
-- o gatilho abaixo cria o perfil sozinho, já marcando os administradores.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nome text check (nome is null or char_length(nome) between 1 and 120),
  estado text check (estado is null or estado ~ '^[A-Z]{2}$'),
  papel text not null default 'vendedor' check (papel in ('vendedor', 'admin')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Funções auxiliares das policies. São security definer para não cair em
-- recursão de RLS ao consultar a própria tabela profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and papel = 'admin' and ativo
  );
$$;

create or replace function public.is_ativo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and ativo
  );
$$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_ativo() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_ativo() to authenticated;

-- Cada um lê o próprio perfil; o administrador lê todos.
-- Não há policy de insert/update/delete: o perfil nasce pelo gatilho e muda
-- só pelas funções abaixo (assim o vendedor não consegue se promover a admin).
drop policy if exists "Perfil: leitura" on public.profiles;
create policy "Perfil: leitura" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

-- Administradores definidos pelo Celso. O repositório é público, então os
-- e-mails ficam só como sha256 (minúsculas). Para incluir outro administrador,
-- crie uma migração que recrie esta função com o hash do novo e-mail
-- (ou promova a pessoa em Painel > Vendedores).
create or replace function public.email_admin(p_email text)
returns boolean
language sql
immutable
as $$
  select encode(sha256(convert_to(lower(trim(coalesce(p_email, ''))), 'UTF8')), 'hex') in (
    '9cf2d9b4dba835898884389e1306a8ef9407fd54142ddcbaba71005f9fbd3ef5',
    'a314a67f3879dbd4e1e38095737ceb59ab3085e482ab44ea37d07ce0554dbcd3'
  );
$$;

revoke execute on function public.email_admin(text) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome, papel)
  values (
    new.id,
    lower(new.email),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'nome', new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', '')), ''),
    case when public.email_admin(new.email) then 'admin' else 'vendedor' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuários que já existirem antes desta migração.
insert into public.profiles (id, email, papel)
select u.id, lower(u.email),
  case when public.email_admin(u.email) then 'admin' else 'vendedor' end
from auth.users u
where u.email is not null
on conflict (id) do nothing;

-- O vendedor só pode mudar o próprio nome (pedido no primeiro acesso).
create or replace function public.atualizar_meu_nome(p_nome text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if char_length(trim(coalesce(p_nome, ''))) not between 2 and 120 then
    raise exception 'nome inválido';
  end if;
  update public.profiles set nome = trim(p_nome) where id = (select auth.uid());
end;
$$;

-- O administrador edita nome, UF, papel e se o vendedor está ativo.
create or replace function public.admin_atualizar_perfil(
  p_id uuid, p_nome text, p_estado text, p_papel text, p_ativo boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'acesso negado';
  end if;
  -- Evita o administrador se trancar fora do painel por engano.
  if p_id = (select auth.uid()) and (p_papel <> 'admin' or not p_ativo) then
    raise exception 'não é possível remover o próprio acesso de administrador';
  end if;
  update public.profiles
     set nome = nullif(trim(coalesce(p_nome, '')), ''),
         estado = nullif(upper(trim(coalesce(p_estado, ''))), ''),
         papel = p_papel,
         ativo = p_ativo
   where id = p_id;
end;
$$;

revoke execute on function public.atualizar_meu_nome(text) from public, anon;
revoke execute on function public.admin_atualizar_perfil(uuid, text, text, text, boolean) from public, anon;
grant execute on function public.atualizar_meu_nome(text) to authenticated;
grant execute on function public.admin_atualizar_perfil(uuid, text, text, text, boolean) to authenticated;
