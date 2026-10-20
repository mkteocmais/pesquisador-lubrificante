# Pesquisador de Lubrificante (repo `pesquisador-lubrificante`)

App de pesquisa de preço de mercado do Grupo Pax. Os vendedores lançam no celular os preços de lubrificantes de concorrentes que encontram em campo, ligam cada um ao nosso produto equivalente e recebem na hora o retorno de como aquele preço está. O administrador baixa tudo em Excel no computador. Toda a interface é em **português do Brasil**, com textos curtos e diretos.

Segue a mesma base e as mesmas convenções do Juntto (`mkteocmais/dinheiro-do-casal`).

## Stack e infraestrutura

- **React 18 + TypeScript strict + Create React App** (`react-scripts` 5), **Tailwind 3.4** e ícones `lucide-react`. Só tema claro.
- **Supabase** (projeto `udbaskofvhcaudyeolrd`, "PesquisaLubrificantes"): Postgres com RLS, Auth (e-mail/senha, **sem cadastro aberto**) e Storage (bucket público `fotos-lubrificantes`).
- **Vercel** (projeto `pesquisador-lubrificante`): publica a cada push na `main`; preview em cada PR. Build e CSP em `vercel.json`.
- **GitHub Actions**:
  - `ci.yml`: typecheck + build em todo PR (e dry-run das migrações quando os secrets existem).
  - `supabase.yml`: aplica `supabase/migrations/` quando chegam na `main`. Precisa dos secrets `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD`.

## Comandos

```bash
npm ci
npm run typecheck
CI=true npm run build   # igual ao da Vercel/CI (warning de ESLint quebra o build)
npm start               # dev server; usa o projeto de produção por padrão (ver src/lib/supabaseClient.ts)
```

Antes de qualquer commit, `npm run typecheck` e `CI=true npm run build` precisam passar.

## Estrutura

```
src/
  App.tsx                     sessão, perfil, abas (Lançar / Meus preços / Painel)
  lib/api.ts                  único lugar que fala com o Supabase
  components/auth/            login (sem cadastro) e primeiro acesso (pede o nome)
  components/lancar/          formulário, escolha do equivalente, retorno de preço (DevolutivaCard)
  components/meus/            lista e detalhe dos lançamentos do vendedor
  components/painel/          administrador: lançamentos + Excel, equivalências, vendedores
  utils/options.ts            viscosidades, fluxos de venda, embalagens (com volume), UFs
  utils/exportar.ts           monta a planilha (Lançamentos, Equivalências, Resumo de preços)
  utils/xlsx.ts               gerador de .xlsx sem biblioteca (ZIP "store" + XML)
  types/index.ts              tipos que espelham as tabelas
supabase/migrations/          histórico do schema (fonte da verdade)
supabase/pendentes/           SQL que só deve virar migração depois de um passo manual
```

## Modelo de dados

- `profiles`: um por login (`id = auth.users.id`), `papel` `vendedor|admin`, `ativo`. Criado pelo gatilho `on_auth_user_created`; os e-mails de administrador ficam como hash sha256 em `email_admin()` (o repositório é público). Muda só pelas funções `atualizar_meu_nome` e `admin_atualizar_perfil`.
- `produtos`: nossas linhas comerciais (nome comercial da planilha "Mapeamento Produtos Pesquisa"); `produto_skus`: código SAP e embalagem de cada linha.
- `lubricants`: os lançamentos (nome herdado do app antigo). `user_id` = vendedor, `produto_ref_id` = nosso equivalente, `cliente` = fluxo de venda, `sku` = embalagem, `dados_originais` = valores antes da limpeza de dados. Lançamentos antigos têm `user_id` nulo e só o nome em `colaborador`.
- **Base de equivalências** = agregação de `lubricants` por marca + produto do concorrente → `produto_ref_id`. Não há tabela própria: cada vínculo feito pelo vendedor conta, e o administrador pode vincular em lote no Painel.

## Regras de negócio (NÃO quebrar)

1. **Retorno de preço** (`devolutiva_preco`): compara com a **mesma embalagem** e o **mesmo fluxo de venda**, nos últimos 12 meses, sem o próprio lançamento. Primeiro entre os ligados ao mesmo equivalente nosso, depois entre todos da mesma viscosidade; no estado e no Brasil. Usa **mediana** (robusta a erro de digitação). Com **menos de 3** pesquisas devolve só a contagem, para não expor o preço de um único lançamento de outro vendedor.
2. **O vendedor só vê os próprios lançamentos.** Tudo o que cruza dados de vendedores (retorno, autocompletar, sugestão de equivalente) passa por função `security definer` que devolve só agregados, nunca linhas.
3. Comparações de texto usam `chave_texto` (sem acento, minúsculas, sem espaço sobrando) e de viscosidade `chave_visc` ("SAE 15W-40" = "15w40"). No front, as mesmas regras estão em `utils/format.ts`; mude os dois juntos.
4. UF sempre em sigla de 2 letras.

## Banco de dados e segurança

- **RLS em tudo.** Policies `to authenticated` usando `auth.uid()`, `public.is_admin()` e `public.is_ativo()`.
- **Mudança de schema = arquivo de migração** em `supabase/migrations/<YYYYMMDDHHMMSS>_<nome>.sql`, aplicado pelo `supabase.yml` no merge. Não aplique DDL direto em produção pelo MCP/CLI. Consultas de leitura pelo MCP estão liberadas.
- Funções `security definer`: `set search_path = public` e `revoke ... from public, anon`.
- As policies anônimas do app antigo ainda existem até a troca de versão: ver `supabase/pendentes/desliga_acesso_anonimo.sql`.
- A URL e a chave publicável do Supabase são públicas por definição; a `service_role` nunca vai para o front.
- CSP em `vercel.json`: domínio externo novo precisa entrar em `connect-src` (hoje: Supabase e `nominatim.openstreetmap.org`, para cidade/UF pelo GPS).

## Convenções de código e UI

- Iguais às do Juntto: componentes funcionais, sem bibliotecas novas sem necessidade, `autoComplete="off"` nos campos, `placeholder` em vez de valor de exemplo, `inputMode="decimal"` em valores.
- Erros sempre via `useToast()` com `mensagemErro()`; nunca mostre o erro cru do Supabase.
- Cores: marca azul-marinho `#002B5C` (`brand`), destaque vermelho `#E30613` (`accent`, usado com moderação). Tokens em `tailwind.config.js` e `src/utils/theme.ts`.
- Mobile first (a partir de 360px). O Painel é pensado para o computador, mas funciona no celular.
- Comentários em português, explicando o **porquê**.

## Dados reais

O banco tem preços reais de mercado e nomes de vendedores. Não exponha esses dados em PR, issue, log ou artifact; para testes e screenshots use dados fictícios.
