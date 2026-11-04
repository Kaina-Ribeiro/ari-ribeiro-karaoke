/** Fotos comprimidas no navegador antes de subir: WebP, lado maior 1200 px, qualidade 0.82. */
const LADO_MAX = 1200;
const QUALIDADE = 0.82;
const LIMITE = 2 * 1024 * 1024;

/** Recortada = mais de 1% dos pixels com fundo transparente (alfa < 250). Ruído num canto não conta. */
export function temTransparencia(rgba: Uint8ClampedArray): boolean {
  const total = rgba.length / 4;
  let transparentes = 0;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 250) transparentes++;
  return transparentes / total > 0.01;
}

export async function comprimeFoto(arquivo: File): Promise<{ blob: Blob; recortada: boolean }> {
  let img: ImageBitmap;
  try {
    img = await createImageBitmap(arquivo);
  } catch {
    throw new Error("Não consegui abrir essa foto. Use JPG, PNG ou WebP.");
  }
  const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * escala);
  canvas.height = Math.round(img.height * escala);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close();
  const recortada = temTransparencia(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/webp", QUALIDADE));
  // navegador sem WebP devolve PNG: o servidor recusaria
  if (!blob || blob.type !== "image/webp") throw new Error("Esse navegador não consegue preparar a foto. Tente pelo Chrome.");
  if (blob.size > LIMITE) throw new Error("A foto ficou grande demais mesmo comprimida. Tente outra.");
  return { blob, recortada };
}

/** Comprime e sobe pro R2. Devolve a chave e a URL local pra prévia. */
export async function enviaFoto(arquivo: File, envia: (form: FormData) => Promise<{ chave: string }>) {
  const { blob, recortada } = await comprimeFoto(arquivo);
  const form = new FormData();
  form.set("tipo", "foto");
  form.set("arquivo", new File([blob], "foto.webp", { type: "image/webp" }));
  const { chave } = await envia(form);
  return { chave, recortada, src: URL.createObjectURL(blob) };
}
