# Pesquisador de Lubrificante

Pesquisa de preço de mercado para a equipe comercial do Grupo Pax.

- **Vendedor (celular):** entra com e-mail e senha, lança o preço do concorrente (com foto opcional), informa o desempenho (API, ACEA, DEXOS...), liga ao nosso produto equivalente e vê na hora se o preço está acima, abaixo ou na média do que a equipe já pesquisou. Em "Meus preços" consulta, corrige e apaga o que lançou e vê o ranking de envios da equipe. Na aba "Equivalências" consulta a base concorrente → produto nosso. O vendedor não baixa preços.
- **Administrador (computador):** vê em "Meus preços" os preços de todos os vendedores (com filtro por vendedor) e, no Painel, todos os lançamentos com filtros, baixa a planilha Excel (Lançamentos, Equivalências e Resumo de preços), monta a base de equivalências, mantém os cadastros de Empresas, Marcas e Produtos (que alimentam o autocompletar, com aviso de nomes duplicados parecidos) e gerencia os vendedores.

## Rodando localmente

```bash
npm install
npm start
```

O app já aponta para o projeto Supabase de produção. Para usar outro, copie `.env.example` para `.env`.

## Criar o acesso de um vendedor

1. Supabase → **Authentication → Users → Add user → Create new user**.
2. Informe o e-mail e uma senha e marque **Auto Confirm User**.
3. No primeiro login o vendedor informa o nome. O administrador pode ajustar nome, UF, papel e bloquear o acesso em **Painel → Vendedores**.

Os administradores são definidos na migração `supabase/migrations/20261020190923_perfis_vendedores.sql`.

## Publicação

- Push na `main` → a Vercel publica o app.
- Migrações em `supabase/migrations/` → o workflow **Supabase deploy** aplica no banco (precisa dos secrets `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD` no GitHub).
