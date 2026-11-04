/**
 * Fotos comprimidas no navegador antes de subir: WebP, lado maior 1200 px, qualidade 0.82.
 * Onde o navegador não gera WebP (Safari, e todo navegador no iPhone), vai JPG (foto comum) ou PNG (fundo
 * transparente). Se passar de 2 MB, diminui e tenta de novo.
 */
const LADO_MAX = 1200;
const QUALIDADE = 0.82;
const LIMITE = 2 * 1024 * 1024;
const TENTATIVAS = 3;

/** Recortada = mais de 1% dos pixels com fundo transparente (alfa < 250). Ruído num canto não conta. */
export function temTransparencia(rgba: Uint8ClampedArray): boolean {
  const total = rgba.length / 4;
  let transparentes = 0;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 250) transparentes++;
  return transparentes / total > 0.01;
}

const gera = (canvas: HTMLCanvasElement, tipo: string) => new Promise<Blob | null>((ok) => canvas.toBlob(ok, tipo, QUALIDADE));

export async function comprimeFoto(arquivo: File): Promise<{ blob: Blob; recortada: boolean }> {
  let img: ImageBitmap;
  try {
    img = await createImageBitmap(arquivo);
  } catch {
    throw new Error("Não consegui abrir essa foto. Use JPG, PNG ou WebP.");
  }
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  let lado = LADO_MAX;
  let recortada: boolean | undefined;
  try {
    for (let tentativa = 0; tentativa < TENTATIVAS; tentativa++) {
      const escala = Math.min(1, lado / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      recortada ??= temTransparencia(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
      let blob = await gera(canvas, "image/webp");
      // sem codificador WebP o navegador devolve PNG: aí escolhemos o formato certo pra foto
      if (!blob || blob.type !== "image/webp") blob = await gera(canvas, recortada ? "image/png" : "image/jpeg");
      if (!blob) throw new Error("Não consegui preparar a foto. Tente outra.");
      if (blob.size <= LIMITE) return { blob, recortada };
      lado = Math.round(lado * 0.75);
    }
  } finally {
    img.close();
  }
  throw new Error("A foto ficou grande demais mesmo comprimida. Tente outra.");
}

const EXTENSAO: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

/** Comprime e sobe pro R2. Devolve a chave e a URL local pra prévia. */
export async function enviaFoto(arquivo: File, envia: (form: FormData) => Promise<{ chave: string }>) {
  const { blob, recortada } = await comprimeFoto(arquivo);
  const form = new FormData();
  form.set("tipo", "foto");
  form.set("arquivo", new File([blob], `foto.${EXTENSAO[blob.type] ?? "webp"}`, { type: blob.type }));
  const { chave } = await envia(form);
  return { chave, recortada, src: URL.createObjectURL(blob) };
}
