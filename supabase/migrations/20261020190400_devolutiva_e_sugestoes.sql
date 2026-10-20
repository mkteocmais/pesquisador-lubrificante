-- Funções que dão o retorno de preço ao vendedor e as sugestões do formulário.
-- O vendedor só enxerga os próprios lançamentos (RLS), então estas funções são
-- security definer e devolvem apenas números agregados, nunca linhas de outros.

-- Chave de comparação de texto: minúsculas, sem acento e espaços repetidos.
create or replace function public.chave_texto(t text)
returns text
language sql
immutable
as $$
  select nullif(
    regexp_replace(
      translate(lower(trim(coalesce(t, ''))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
      '\s+', ' ', 'g'),
    '');
$$;

-- "SAE 15W-40", "15w40" e "15W-40" viram "15w40"; "ISO 68" vira "iso68".
create or replace function public.chave_visc(t text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(lower(coalesce(t, '')), '(^\s*sae)|[\s\-]', '', 'g'), '');
$$;

-- Estatística de preço de um recorte. Interna: só é chamada pela devolutiva.
-- Com menos de 3 pesquisas devolve só a contagem, para não expor o preço de
-- um único lançamento de outro vendedor.
create or replace function public._estatistica_preco(
  p_excluir uuid, p_ref uuid, p_visc text, p_sku text, p_cliente text, p_estado text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with recorte as (
    select l.preco
      from public.lubricants l
     where l.id <> p_excluir
       and l.preco > 0
       and l.created_at > now() - interval '12 months'
       and (p_ref is null or l.produto_ref_id = p_ref)
       and (p_visc is null or public.chave_visc(l.viscosidade) = p_visc)
       and public.chave_texto(l.sku) is not distinct from public.chave_texto(p_sku)
       and coalesce(l.cliente, '') = coalesce(p_cliente, '')
       and (p_estado is null or l.estado = p_estado)
  )
  select case
    when count(*) < 3 then jsonb_build_object('n', count(*))
    else jsonb_build_object(
      'n', count(*),
      'mediana', round((percentile_cont(0.5) within group (order by preco))::numeric, 2),
      'minimo', min(preco),
      'maximo', max(preco))
  end
  from recorte;
$$;

revoke execute on function public._estatistica_preco(uuid, uuid, text, text, text, text) from public, anon, authenticated;

-- Retorno de um lançamento: compara com a mesma embalagem e o mesmo fluxo de
-- venda, primeiro entre os produtos ligados ao mesmo equivalente nosso e
-- depois entre todos da mesma viscosidade; no estado e no Brasil.
create or replace function public.devolutiva_preco(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.lubricants;
  v_visc text;
begin
  select * into r from public.lubricants where id = p_id;
  if not found or not (r.user_id = (select auth.uid()) or public.is_admin()) then
    return null;
  end if;
  v_visc := public.chave_visc(r.viscosidade);
  return jsonb_build_object(
    'preco', r.preco,
    'equivalente', case when r.produto_ref_id is null then null else jsonb_build_object(
      'estado', case when r.estado is null then null
                     else public._estatistica_preco(r.id, r.produto_ref_id, null, r.sku, r.cliente, r.estado) end,
      'brasil', public._estatistica_preco(r.id, r.produto_ref_id, null, r.sku, r.cliente, null)) end,
    'viscosidade', case when v_visc is null then null else jsonb_build_object(
      'estado', case when r.estado is null then null
                     else public._estatistica_preco(r.id, null, v_visc, r.sku, r.cliente, r.estado) end,
      'brasil', public._estatistica_preco(r.id, null, v_visc, r.sku, r.cliente, null)) end
  );
end;
$$;

-- Marcas e produtos de concorrentes já pesquisados por qualquer vendedor,
-- para o autocompletar (sem preço, sem empresa, sem quem lançou).
create or replace function public.catalogo_concorrentes()
returns table (marca text, produto text, viscosidade text, usos bigint)
language sql
stable
security definer
set search_path = public
as $$
  select min(trim(l.marca)), min(trim(l.produto)), min(trim(l.viscosidade)), count(*)
    from public.lubricants l
   where public.is_ativo()
     and public.chave_texto(l.marca) is not null
   group by public.chave_texto(l.marca), public.chave_texto(l.produto), public.chave_visc(l.viscosidade)
   order by count(*) desc;
$$;

-- Nosso produto mais usado por outros vendedores para aquele concorrente.
create or replace function public.sugerir_equivalente(p_marca text, p_produto text)
returns table (produto_id uuid, usos bigint)
language sql
stable
security definer
set search_path = public
as $$
  select l.produto_ref_id, count(*)
    from public.lubricants l
   where public.is_ativo()
     and l.produto_ref_id is not null
     and public.chave_texto(l.marca) = public.chave_texto(p_marca)
     and public.chave_texto(l.produto) = public.chave_texto(p_produto)
   group by l.produto_ref_id
   order by count(*) desc
   limit 3;
$$;

revoke execute on function public.devolutiva_preco(uuid) from public, anon;
revoke execute on function public.catalogo_concorrentes() from public, anon;
revoke execute on function public.sugerir_equivalente(text, text) from public, anon;
grant execute on function public.devolutiva_preco(uuid) to authenticated;
grant execute on function public.catalogo_concorrentes() to authenticated;
grant execute on function public.sugerir_equivalente(text, text) to authenticated;
