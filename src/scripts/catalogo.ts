import { busca, NOTA_CODIGO_EXATO, preparaItem, soDigitos, trechosQueBatem, type Item, type Resultado } from "../lib/busca.ts";
import { escapa, letraDe, normaliza, type Pacote } from "../lib/texto.ts";
import type { Catalogo } from "../lib/planilha.ts";

interface Manifesto { total: number; temLetras: boolean; catalogo: string; letras: string }

const ZAP = "5512991167274";
const POR_PAGINA = 50;
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const manifesto: Manifesto = JSON.parse($("#manifesto").textContent!);

let itens: Item[] = [];
let letras: string[] = [];          // texto original, pra mostrar
let letrasBusca: string[] | undefined; // normalizado, pra buscar
let carregandoLetras: Promise<void> | undefined;
let ordenadas: Resultado[] = [];
const st = { q: "", filtro: "todas" as "todas" | "fav" | Pacote, ordem: "art" as "art" | "tit" | "cod", pagina: 0 };

/* ---------- armazenamento local (favoritas e comanda) ---------- */
function ler<T>(chave: string, padrao: T): T {
  try { return JSON.parse(localStorage.getItem(chave) ?? "") as T; } catch { return padrao; }
}
function grava(chave: string, valor: unknown) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* modo anônimo: segue sem salvar */ }
}
let favs = new Set<string>(ler<string[]>("ari.favoritas", []));
interface ItemComanda { cod: string; tit: string; art: string }
let comanda = ler<ItemComanda[]>("ari.comanda", []);

/* ---------- dados ---------- */
async function carregaCatalogo() {
  const letrasJa = manifesto.temLetras ? carregaLetras() : undefined;
  const c: Catalogo = await (await fetch(manifesto.catalogo)).json();
  itens = c.musicas.map(([cod, a, tit, pk], i) => preparaItem(i, cod, c.artistas[a], tit, pk));
  // a primeira página veio com letra no HTML; espera as letras pra coluna não piscar "—"
  await letrasJa;
  desenhaAZ();
  desenha();
}
function precisaLetras(q: string) {
  return manifesto.temLetras && !letrasBusca && normaliza(q).length >= 3 && !soDigitos(normaliza(q));
}
function carregaLetras() {
  return carregandoLetras ??= fetch(manifesto.letras).then((r) => r.json()).then((l: string[]) => {
    letras = l;
    letrasBusca = l.map(normaliza);
    desenha();
  }).catch(() => { carregandoLetras = undefined; });
}

/* ---------- desenho ---------- */
function grifa(texto: string, q: string, frase = false) {
  let out = "", k = 0;
  for (const [a, b] of trechosQueBatem(texto, q, frase)) {
    out += escapa(texto.slice(k, a)) + "<mark>" + escapa(texto.slice(a, b)) + "</mark>";
    k = b;
  }
  return out + escapa(texto.slice(k));
}
const corta = (t: string) => (t.length > 110 ? t.slice(0, 110).replace(/\s\S*$/, "") + "…" : t);

function linha(m: Item, q: string, pelaLetra: boolean) {
  const na = comanda.some((x) => x.cod === m.codigo);
  const fav = favs.has(m.codigo);
  const tag = m.pacote === "nova" ? `<span class="tag nova">nova</span>` : m.pacote === "exc" ? `<span class="tag exc">só no Ari</span>` : "";
  const tr = letras[m.i] ?? "";
  const letra = tr ? (pelaLetra ? grifa(corta(tr), q, true) : escapa(corta(tr))) : `<span class="sem">—</span>`;
  return `<li class="faixa-m${na ? " na-comanda" : ""}" data-cod="${m.codigo}" tabindex="0" title="Toque pra copiar o código">`
    + `<span class="cod">${m.codigo}</span>`
    + `<button class="art" data-q="${escapa(m.artista)}">${grifa(m.artista, q)}</button>`
    + `<span class="tit">${grifa(m.titulo, q)}${tag}</span>`
    + `<span class="let${tr ? "" : " vazia"}" title="${escapa(tr)}">${letra}</span>`
    + `<span class="bts"><button class="fav" data-fav="${m.codigo}" aria-pressed="${fav}" aria-label="${fav ? "Desfavoritar" : "Favoritar"} ${escapa(m.titulo)}">${fav ? "★" : "☆"}</button>`
    + `<button class="mais" data-add="${m.codigo}" aria-label="${na ? "Tirar da" : "Pôr na"} comanda: ${escapa(m.titulo)}">${na ? "✓" : "+"}</button></span></li>`;
}

function paginador(n: number) {
  if (n <= 1) return "";
  const p = st.pagina;
  const nums = [...new Set([0, n - 1, p - 1, p, p + 1].filter((i) => i >= 0 && i < n))].sort((a, b) => a - b);
  let o = "", ant = -1;
  for (const i of nums) {
    if (i - ant > 1) o += `<span class="reti">…</span>`;
    o += `<button data-pag="${i}"${i === p ? ' aria-current="page"' : ""}>${i + 1}</button>`;
    ant = i;
  }
  return `<nav class="paginas" aria-label="Páginas"><button data-pag="${p - 1}" ${p === 0 ? "disabled" : ""}>← Anterior</button><div class="nums">${o}</div><button data-pag="${p + 1}" ${p === n - 1 ? "disabled" : ""}>Próxima →</button></nav>`;
}

const ABAS: [typeof st.filtro, string][] = [["todas", "Todas"], ["fav", "★ Favoritas"], ["nova", "Novidades"], ["exc", "Só no Ari"]];
function desenhaAbas() {
  const c: Record<string, number> = { todas: itens.length, fav: 0, nova: 0, exc: 0, base: 0 };
  for (const m of itens) { c[m.pacote]++; if (favs.has(m.codigo)) c.fav++; }
  $("#abas").innerHTML = ABAS.map(([k, l]) => `<button data-f="${k}" aria-pressed="${st.filtro === k}">${l}<sup>${c[k].toLocaleString("pt-BR")}</sup></button>`).join("");
}

function desenhaAZ() {
  const tem = new Set(itens.map((m) => letraDe(m.artista)));
  $("#az").innerHTML = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"]
    .map((L) => (tem.has(L) ? `<a href="#letra-${L === "#" ? "num" : L}" data-letra="${L}">${L}</a>` : `<span>${L}</span>`)).join("");
}

const zap = (ms: ItemComanda[], quem = "") =>
  `https://wa.me/${ZAP}?text=` + encodeURIComponent(`Oi! ${quem ? quem + " quer" : "Quero"} cantar:\n` + ms.map((m) => `• ${m.cod} · ${m.tit} (${m.art})`).join("\n"));

function desenha() {
  if (!itens.length) return;
  if (precisaLetras(st.q)) carregaLetras();
  const q = normaliza(st.q);
  const filtro = (m: Item) => (st.filtro === "todas" ? true : st.filtro === "fav" ? favs.has(m.codigo) : m.pacote === st.filtro);
  let rs = busca(itens, st.q, letrasBusca, filtro);
  $("#contaCat").textContent = rs.length.toLocaleString("pt-BR") + (rs.length === 1 ? " música" : " músicas");
  $("#tituloCat").firstChild!.textContent = q ? "Achamos " : "Repertório ";

  let h = "";
  const exato = soDigitos(q) ? rs.find((r) => r.nota === NOTA_CODIGO_EXATO) : undefined;
  if (exato) {
    const m = exato.item, na = comanda.some((x) => x.cod === m.codigo);
    h += `<div class="telinha"><small>Achou! Digita na máquina</small><div class="big">${m.codigo}</div><div class="nome">${escapa(m.titulo)} · ${escapa(m.artista)}</div>`
      + `<div class="acoes"><button class="bt cheio" data-add="${m.codigo}">${na ? "Na comanda ✓" : "+ Comanda"}</button>`
      + `<button class="bt cheio" data-fav="${m.codigo}">${favs.has(m.codigo) ? "★ Favorita" : "☆ Favoritar"}</button>`
      + `<a class="bt zap" target="_blank" rel="noopener" href="${zap([{ cod: m.codigo, tit: m.titulo, art: m.artista }])}">Pedir pro KJ</a></div></div>`;
    rs = rs.filter((r) => r !== exato);
  }

  if (!rs.length && !exato && st.filtro === "fav" && !q) {
    h += `<div class="vazio"><h3>Nenhuma favorita ainda</h3><p>Toca na ☆ do lado de uma música pra guardar aqui. Fica salvo neste celular, pra próxima vez que vier cantar.</p><button class="bt" data-f="todas">Ver todas as músicas</button></div>`;
  } else if (!rs.length && !exato) {
    const pedido = `https://wa.me/${ZAP}?text=` + encodeURIComponent(`Oi Ari! Procurei e não achei no catálogo: ${st.q}. Dá pra adicionar?`);
    h += `<div class="vazio"><h3>Essa ainda não tem</h3><p>Não achamos “${escapa(st.q)}”. Pede pro Ari, ele vê se entra no próximo pacote.</p><a class="bt zap" target="_blank" rel="noopener" href="${pedido}">Pedir música nova</a></div>`;
  } else {
    const porArt = (a: Resultado, b: Resultado) => a.item.artista.localeCompare(b.item.artista, "pt") || a.item.titulo.localeCompare(b.item.titulo, "pt");
    if (q) rs.sort((a, b) => b.nota - a.nota || porArt(a, b));
    else if (st.ordem === "tit") rs.sort((a, b) => a.item.titulo.localeCompare(b.item.titulo, "pt"));
    else if (st.ordem === "cod") rs.sort((a, b) => +a.item.codigo - +b.item.codigo);
    else rs.sort(porArt);
    ordenadas = rs;
    const paginas = Math.ceil(rs.length / POR_PAGINA);
    st.pagina = Math.min(st.pagina, Math.max(0, paginas - 1));
    let L0 = "", li = "";
    for (const r of rs.slice(st.pagina * POR_PAGINA, (st.pagina + 1) * POR_PAGINA)) {
      if (!q && st.ordem === "art") {
        const L = letraDe(r.item.artista);
        if (L !== L0) { li += `<li class="faixa-letra" id="letra-${L === "#" ? "num" : L}">${L}</li>`; L0 = L; }
      }
      li += linha(r.item, q, r.pelaLetra);
    }
    h += `<div class="tabela"><div class="cabecalho" aria-hidden="true"><span>Código</span><span>Cantor</span><span>Música</span><span>Começo da letra</span><span></span></div><ul class="musicas">${li}</ul></div>`;
    h += paginador(paginas);
  }
  $("#lista").innerHTML = h;
  $("#limpa").hidden = !st.q;
  desenhaAbas();
}

/* ---------- comanda ---------- */
function desenhaComanda() {
  $("#nComanda").textContent = String(comanda.length);
  $("#totalC").textContent = String(comanda.length).padStart(2, "0");
  $("#itens").innerHTML = comanda.length
    ? comanda.map((m, i) => `<li><span class="c">${m.cod}</span><span class="t">${escapa(m.tit)}<small>${escapa(m.art)}</small></span><button data-tira="${i}" aria-label="Tirar ${escapa(m.tit)}">×</button></li>`).join("")
    : `<li class="nada">Comanda vazia. Toca no + do lado de uma música pra anotar aqui.</li>`;
  $<HTMLAnchorElement>("#mandar").href = comanda.length ? zap(comanda, $<HTMLInputElement>("#cantor").value.trim()) : "https://wa.me/" + ZAP;
}
function abreComanda(abrir: boolean) {
  $("#comanda").classList.toggle("on", abrir);
  $("#veu").classList.toggle("on", abrir);
  $("#comanda").setAttribute("aria-hidden", String(!abrir));
  if (abrir) { desenhaComanda(); $("#fechaComanda").focus(); }
}
function aviso(t: string) {
  const a = $("#aviso");
  a.textContent = t;
  a.classList.add("on");
  clearTimeout(Number(a.dataset.t));
  a.dataset.t = String(setTimeout(() => a.classList.remove("on"), 1600));
}
function alternaComanda(cod: string) {
  const i = comanda.findIndex((x) => x.cod === cod);
  if (i >= 0) { comanda.splice(i, 1); aviso("Riscado da comanda"); }
  else {
    const m = itens.find((x) => x.codigo === cod);
    if (!m) return;
    comanda.push({ cod: m.codigo, tit: m.titulo, art: m.artista });
    aviso("Anotado na comanda!");
    const n = $("#nComanda");
    n.classList.remove("pula"); void n.offsetWidth; n.classList.add("pula");
  }
  grava("ari.comanda", comanda);
  desenhaComanda();
  desenha();
}
function alternaFavorita(cod: string) {
  if (favs.has(cod)) { favs.delete(cod); aviso("Saiu das favoritas"); } else { favs.add(cod); aviso("Favoritada!"); }
  grava("ari.favoritas", [...favs]);
  desenha();
}
function copia(li: HTMLElement) {
  const c = li.dataset.cod!;
  const ok = () => { li.classList.add("copiou"); setTimeout(() => li.classList.remove("copiou"), 1200); };
  navigator.clipboard?.writeText(c).then(ok, () => { ok(); aviso("Código " + c); }) ?? (ok(), aviso("Código " + c));
}

/* ---------- eventos ---------- */
const campo = $<HTMLInputElement>("#q");
if (matchMedia("(max-width: 520px)").matches) campo.placeholder = "Código, cantor ou letra";
let espera: ReturnType<typeof setTimeout>;
campo.addEventListener("input", () => {
  clearTimeout(espera);
  espera = setTimeout(() => { st.q = campo.value; st.pagina = 0; desenha(); }, 80);
});
$<HTMLSelectElement>("#ordem").addEventListener("change", (e) => { st.ordem = (e.target as HTMLSelectElement).value as typeof st.ordem; st.pagina = 0; desenha(); });
$("#limpa").addEventListener("click", () => { campo.value = ""; st.q = ""; st.pagina = 0; desenha(); campo.focus(); });
$("#cantor").addEventListener("input", desenhaComanda);
$("#abreComanda").addEventListener("click", () => abreComanda(true));
$("#fechaComanda").addEventListener("click", () => abreComanda(false));
$("#veu").addEventListener("click", () => abreComanda(false));

document.addEventListener("keydown", (e) => {
  const ativo = document.activeElement as HTMLElement | null;
  if (e.key === "Escape") abreComanda(false);
  if (e.key === "/" && !/INPUT|SELECT|TEXTAREA/.test(ativo?.tagName ?? "")) { e.preventDefault(); campo.focus(); }
  if (e.key === "Enter" && ativo?.classList.contains("faixa-m")) copia(ativo);
});

document.addEventListener("click", (e) => {
  const alvo = e.target as HTMLElement;
  const b = alvo.closest<HTMLElement>("[data-q],[data-f],[data-add],[data-tira],[data-pag],[data-fav]");
  if (b) {
    const d = b.dataset;
    if (d.pag !== undefined) { if ((b as HTMLButtonElement).disabled) return; st.pagina = +d.pag; desenha(); $(".catalogo").scrollIntoView(); return; }
    if (d.q !== undefined) { campo.value = d.q; st.q = d.q; st.pagina = 0; desenha(); $("#catalogo").scrollIntoView(); return; }
    if (d.f) { st.filtro = d.f as typeof st.filtro; st.pagina = 0; desenha(); return; }
    if (d.fav) { alternaFavorita(d.fav); return; }
    if (d.add) { alternaComanda(d.add); return; }
    if (d.tira !== undefined) { comanda.splice(+d.tira, 1); grava("ari.comanda", comanda); desenhaComanda(); desenha(); return; }
  }
  const letra = alvo.closest<HTMLElement>("[data-letra]");
  if (letra && itens.length) {
    e.preventDefault();
    const L = letra.dataset.letra!;
    if (st.q || st.ordem !== "art") { st.q = ""; campo.value = ""; st.ordem = "art"; $<HTMLSelectElement>("#ordem").value = "art"; desenha(); }
    const idx = ordenadas.findIndex((r) => letraDe(r.item.artista) === L);
    if (idx < 0) return;
    st.pagina = Math.floor(idx / POR_PAGINA);
    desenha();
    document.getElementById("letra-" + (L === "#" ? "num" : L))?.scrollIntoView();
    return;
  }
  const li = alvo.closest<HTMLElement>(".faixa-m");
  if (li) copia(li);
});

// outra aba mexeu nas favoritas ou na comanda: acompanha
addEventListener("storage", (e) => {
  if (e.key === "ari.favoritas") { favs = new Set(ler<string[]>("ari.favoritas", [])); desenha(); }
  if (e.key === "ari.comanda") { comanda = ler<ItemComanda[]>("ari.comanda", []); desenhaComanda(); desenha(); }
});

desenhaComanda();
carregaCatalogo().catch(() => aviso("Não deu pra carregar o catálogo. Tenta recarregar a página."));
