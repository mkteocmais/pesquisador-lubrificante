-- APLICAR SÓ DEPOIS QUE O APP NOVO (com login) ESTIVER PUBLICADO NA MAIN.
--
-- O app antigo gravava e lia sem login, com a chave pública que fica no
-- código da página. Enquanto essas policies existirem, qualquer pessoa com a
-- chave consegue baixar todos os preços. Quando todos os vendedores estiverem
-- usando o app novo, mova este arquivo para supabase/migrations/ com um
-- timestamp novo e aplique.

drop policy if exists "Permitir inserção anônima" on public.lubricants;
drop policy if exists "Permitir leitura anônima" on public.lubricants;
drop policy if exists "Permitir upload anonimo" on storage.objects;

-- As fotos continuam públicas pelo link (o bucket é público), mas listar o
-- bucket passa a exigir login.
drop policy if exists "Permitir visualizacao anonima" on storage.objects;

-- Limite de tamanho e tipo das fotos (o app novo já reduz a foto antes de enviar).
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'fotos-lubrificantes';
