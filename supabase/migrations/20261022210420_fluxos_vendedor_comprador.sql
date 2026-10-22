-- Fluxo de venda em dois passos ("Quem está vendendo?" / "Quem está
-- comprando?"), compilado como "Vendedor -> Comprador", com o Distribuidor
-- sempre como "Distribuidor (DA)": ex. "Distribuidor (DA) -> Consumidor".
-- Os lançamentos já gravados passam para esse texto, para o retorno de preço
-- continuar comparando o histórico. O primeiro texto original continua em
-- dados_originais ("cliente").

-- Correção de nome, não edição do vendedor: não mexe no "corrigido em".
select set_config('app.renomeando', 'on', true);

with novo as (
  select l.id,
         regexp_replace(
           regexp_replace(l.cliente, '^Distribuidor\s*->', 'Distribuidor (DA) ->'),
           '^Fábrica -> Atacadista \(Grande Volume\)$', 'Fábrica -> Atacadista') as cliente
    from public.lubricants l
   where l.cliente ~ '^Distribuidor\s*->' or l.cliente = 'Fábrica -> Atacadista (Grande Volume)'
)
update public.lubricants l
   set cliente = n.cliente,
       dados_originais = coalesce(l.dados_originais, '{}'::jsonb)
                         || case when l.dados_originais ? 'cliente' then '{}'::jsonb
                                 else jsonb_build_object('cliente', l.cliente) end
  from novo n
 where l.id = n.id and l.cliente is distinct from n.cliente;
