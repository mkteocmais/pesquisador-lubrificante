-- Padroniza os lançamentos antigos (digitados livres no app anterior) para a
-- análise agrupar certo: "KARTER", "Kater " e "Karter" viram "Karter";
-- "São Paulo" vira "SP"; "NGLI2" vira "NLGI 2" etc.
-- O valor original de cada campo alterado fica em dados_originais.
-- Só mexe no que é inequívoco; o resto recebe apenas trim.

-- Sem o gatilho de updated_at: a limpeza não é uma "edição" do vendedor.
alter table public.lubricants disable trigger lubricants_before_update;

with _mapa (campo, de, para) as (values
  -- Marcas
  ('marca', 'mobil', 'Mobil'),
  ('marca', 'lucheti lubrificantes', 'Lucheti'),
  ('marca', 'lucheti', 'Lucheti'),
  ('marca', 'deiton orion 15w40', 'Deiton'),
  ('marca', 'gt-oil', 'GT-Oil'),
  ('marca', 'gulf oil', 'Gulf'),
  ('marca', 'iconic ipiranga', 'Ipiranga'),
  ('marca', 'ipiranga', 'Ipiranga'),
  ('marca', 'karter', 'Karter'),
  ('marca', 'kater', 'Karter'),
  ('marca', 'llm ( everest)', 'LLM (Everest)'),
  ('marca', 'lubraoil', 'Lubraoil'),
  ('marca', 'lubrax', 'Lubrax'),
  ('marca', 'lubrax hydra 68', 'Lubrax'),
  ('marca', 'maxon lubrificantes', 'Maxon Oil'),
  ('marca', 'maxon oil', 'Maxon Oil'),
  ('marca', 'menzoil', 'Menzoil'),
  ('marca', 'panter', 'Panther'),
  ('marca', 'panther lubrificantes', 'Panther'),
  ('marca', 'petronas', 'Petronas'),
  ('marca', 'shell', 'Shell'),
  ('marca', 'spark lubrificantes', 'Spark'),
  ('marca', 'texaco', 'Texaco'),
  ('marca', 'total energies', 'TotalEnergies'),
  ('marca', 'valvolaine', 'Valvoline'),
  ('marca', 'valvoline', 'Valvoline'),
  ('marca', 'vibra petrobras', 'Vibra Petrobras'),
  ('marca', 'lust lubrificantes', 'Lust'),
  -- Estados -> UF
  ('estado', 'sao paulo', 'SP'),
  ('estado', 'sp', 'SP'),
  ('estado', 'mato grosso', 'MT'),
  ('estado', 'para', 'PA'),
  ('estado', 'parana', 'PR'),
  ('estado', 'maranhao', 'MA'),
  -- Viscosidades
  ('viscosidade', 'ngli2', 'NLGI 2'),
  ('viscosidade', 'nlgi2', 'NLGI 2'),
  ('viscosidade', 'nlgi 2', 'NLGI 2'),
  ('viscosidade', 'chassis ngli 2', 'NLGI 2'),
  ('viscosidade', 'lith ep´nlgi 2', 'NLGI 2'),
  ('viscosidade', '68', 'ISO 68'),
  ('viscosidade', 'iso 68', 'ISO 68'),
  ('viscosidade', 'sae68', 'ISO 68'),
  ('viscosidade', 'iso 460', 'ISO 460'),
  ('viscosidade', 'sae46', 'ISO 46'),
  ('viscosidade', 'sae 46', 'ISO 46'),
  ('viscosidade', 'hidraulico aw 46', 'ISO 46'),
  ('viscosidade', 'sae 220', 'ISO 220'),
  ('viscosidade', '220 re', 'ISO 220'),
  ('viscosidade', 'sae 320', 'ISO 320'),
  ('viscosidade', '1000', 'ISO 1000'),
  ('viscosidade', '85w140', 'SAE 85W-140'),
  ('viscosidade', '85w140 gl5', 'SAE 85W-140'),
  ('viscosidade', 'sae 75w90', 'SAE 75W-90'),
  ('viscosidade', 'sae 75w80', 'SAE 75W-80'),
  ('viscosidade', '80w', 'SAE 80W'),
  ('viscosidade', '80w gl5', 'SAE 80W'),
  ('viscosidade', '10w', 'SAE 10W'),
  ('viscosidade', '30', 'SAE 30'),
  ('viscosidade', 'sae 20w-30', '20W-30'),
  -- Embalagens
  ('sku', 'caixa 24x1 lt', 'Caixa Frascos 24x1L'),
  ('sku', 'balde 20kg', 'Balde 20Kg'),
  ('sku', 'balde 18 kg', 'Balde 18Kg'),
  ('sku', 'balde/18kg', 'Balde 18Kg')
),
novo as (
  select l.id,
    coalesce((select para from _mapa where campo = 'marca' and de = public.chave_texto(l.marca)), nullif(trim(l.marca), '')) as marca,
    coalesce((select para from _mapa where campo = 'estado' and de = public.chave_texto(l.estado)), nullif(trim(l.estado), '')) as estado,
    coalesce((select para from _mapa where campo = 'viscosidade' and de = public.chave_texto(l.viscosidade)), nullif(trim(l.viscosidade), '')) as viscosidade,
    coalesce((select para from _mapa where campo = 'sku' and de = public.chave_texto(l.sku)), nullif(trim(l.sku), '')) as sku,
    coalesce((select para from _mapa where campo = 'colaborador' and de = public.chave_texto(l.colaborador)), nullif(trim(l.colaborador), '')) as colaborador,
    nullif(trim(l.produto), '') as produto,
    nullif(trim(l.empresa), '') as empresa,
    nullif(trim(l.cidade), '') as cidade,
    nullif(trim(l.cliente), '') as cliente
  from public.lubricants l
),
mudou as (
  select n.*, l.dados_originais as orig_atual,
    jsonb_strip_nulls(jsonb_build_object(
      'marca', case when l.marca is distinct from n.marca then l.marca end,
      'estado', case when l.estado is distinct from n.estado then l.estado end,
      'viscosidade', case when l.viscosidade is distinct from n.viscosidade then l.viscosidade end,
      'sku', case when l.sku is distinct from n.sku then l.sku end,
      'colaborador', case when l.colaborador is distinct from n.colaborador then l.colaborador end,
      'produto', case when l.produto is distinct from n.produto then l.produto end,
      'empresa', case when l.empresa is distinct from n.empresa then l.empresa end,
      'cidade', case when l.cidade is distinct from n.cidade then l.cidade end,
      'cliente', case when l.cliente is distinct from n.cliente then l.cliente end
    )) as orig
  from novo n join public.lubricants l on l.id = n.id
)
update public.lubricants l
   set marca = m.marca, estado = m.estado, viscosidade = m.viscosidade, sku = m.sku,
       colaborador = m.colaborador, produto = m.produto, empresa = m.empresa,
       cidade = m.cidade, cliente = m.cliente,
       -- Se a migração rodar de novo, mantém o primeiro original registrado.
       dados_originais = m.orig || coalesce(m.orig_atual, '{}'::jsonb)
  from mudou m
 where l.id = m.id and m.orig <> '{}'::jsonb;

alter table public.lubricants enable trigger lubricants_before_update;
