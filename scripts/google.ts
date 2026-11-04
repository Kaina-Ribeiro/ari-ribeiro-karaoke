/** CSV de uma aba do Google Sheets (planilha pública). Só leitura: nada aqui escreve na planilha do Ari. */
export async function baixaCsv(id: string, aba: string): Promise<string> {
  const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(aba)}`;
  for (let tentativa = 1; ; tentativa++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      if (tentativa === 3) throw new Error(`Não consegui baixar a aba "${aba}" da planilha: ${(e as Error).message}`);
      await new Promise((ok) => setTimeout(ok, 2000 * tentativa));
    }
  }
}
