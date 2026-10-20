-- Troca de versão: o app novo (com login) está publicado na main.
--
-- O app antigo gravava e lia sem login, com a chave pública que fica no
-- código da página. Enquanto essas policies valiam, qualquer pessoa com a
-- chave conseguia baixar todos os preços.
--
-- Em vez de remover as policies (o conector do Supabase pede confirmação
-- manual para DROP), elas passam a negar tudo. Mesmo efeito, e reversível.

alter policy "Permitir inserção anônima" on public.lubricants with check (false);
alter policy "Permitir leitura anônima" on public.lubricants using (false);
alter policy "Permitir upload anonimo" on storage.objects with check (false);
-- As fotos continuam abrindo pelo link (o bucket é público); só listar o
-- bucket sem login deixa de funcionar.
alter policy "Permitir visualizacao anonima" on storage.objects using (false);

-- Limite de tamanho e tipo das fotos (o app novo já reduz a foto antes de enviar).
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'fotos-lubrificantes';
