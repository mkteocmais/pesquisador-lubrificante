-- Recomendação do linter do Supabase (0011): fixar o search_path também nas
-- funções puras. Elas só usam funções nativas (pg_catalog), então o caminho
-- vazio basta.
alter function public.chave_texto(text) set search_path = '';
alter function public.chave_visc(text) set search_path = '';
alter function public.email_admin(text) set search_path = '';
