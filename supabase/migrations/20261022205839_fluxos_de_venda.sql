-- Novos fluxos de venda (de -> para), um a um:
--   Fábrica -> Distribuidor (DA), Atacadista (Grande Volume), Consumidor, Revendedor
--   Distribuidor -> Atacadista, Consumidor, Revendedor
--   Atacadista -> Consumidor, Revendedor
--   Revendedor -> Consumidor
-- O retorno de preço só compara lançamentos do mesmo fluxo, então os
-- lançamentos já feitos passam para o nome novo equivalente. O texto antigo
-- fica guardado em dados_originais ("cliente").

-- Correção de nome, não edição do vendedor: não mexe no "corrigido em".
select set_config('app.renomeando', 'on', true);

with mapa (de, para) as (values
  ('Fábrica -> Distribuidor', 'Fábrica -> Distribuidor (DA)'),
  ('Fábrica -> Consumo', 'Fábrica -> Consumidor'),
  ('Distribuidor -> Revenda', 'Distribuidor -> Revendedor'),
  ('Revenda -> Consumidor Final', 'Revendedor -> Consumidor')
)
update public.lubricants l
   set cliente = m.para,
       dados_originais = coalesce(l.dados_originais, '{}'::jsonb)
                         || case when l.dados_originais ? 'cliente' then '{}'::jsonb
                                 else jsonb_build_object('cliente', l.cliente) end
  from mapa m
 where l.cliente = m.de;
