// Reduz a foto antes de enviar: foto de celular tem 3-8 MB e o vendedor
// costuma estar no 4G. 1600px no lado maior ainda deixa a etiqueta legível.
const LADO_MAX = 1600;

export async function reduzirFoto(arquivo: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(arquivo);
    const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return arquivo;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.8));
    return blob && blob.size < arquivo.size ? blob : arquivo;
  } catch {
    // Formato que o navegador não abre (ex: HEIC em alguns aparelhos): envia como veio.
    return arquivo;
  }
}
