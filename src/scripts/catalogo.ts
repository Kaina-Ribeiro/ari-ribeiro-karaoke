import { busca, NOTA_CODIGO_EXATO, preparaItem, soDigitos, trechosQueBatem, type Item, type Resultado } from "../lib/busca.ts";
import { escapa, letraDe, normaliza, type Pacote } from "../lib/texto.ts";
import type { Catalogo } from "../lib/planilha.ts";

interface Manifesto { total: number; temLetras: boolean; catalogo: string; letras: string; zapKj: string; zapContato: string }

const POR_PAGINA = 50;
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const manifesto: Manifesto = JSON.parse($("#manifesto").textContent!);

let itens: Item[] = [];
let letras: string[] = [];          // texto original, pra mostrar
let letrasBusca: string[] | undefined; // normalizado, pra buscar
let carregandoLetras: Promise<void> | undefined;
let ordenadas: Resultado[] = [];
const st = { q: "", filtro: "todas" as "todas" | "fav" | Pacote, pagina: 0 };

/* ---------- armazenamento local (favoritas e comanda) ---------- */
/** Lista salva no aparelho. Qualquer coisa que não seja lista (dado velho, extensão mexendo) vira lista vazia. */
function ler<T>(chave: string, ok: (x: unknown) => x is T): T[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(chave) ?? "[]");
    return Array.isArray(v) ? v.filter(ok) : [];
  } catch { return []; }
}
function grava(chave: string, valor: unknown) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* modo anônimo: segue sem salvar */ }
}
interface ItemComanda { cod: string; tit: string; art: string }
const ehTexto = (x: unknown): x is string => typeof x === "string";
const ehItem = (x: unknown): x is ItemComanda =>
  !!x && ["cod", "tit", "art"].every((k) => typeof (x as Record<string, unknown>)[k] === "string");
let favs = new Set(ler("ari.favoritas", ehTexto));
let comanda = ler("ari.comanda", ehItem);

/* ---------- dados ---------- */
async function carregaCatalogo() {
  const letrasJa = manifesto.temLetras ? carregaLetras() : undefined;
  const c: Catalogo = await (await fetch(manifesto.catalogo)).json();
  itens = c.musicas.map(([cod, a, tit, pk], i) => preparaItem(i, cod, c.artistas[a], tit, pk));
  const letraArtista = c.artistas.map(letraDe);
  letraItem = c.musicas.map(([, a]) => letraArtista[a]);
  // a primeira página veio com letra no HTML; espera as letras pra coluna não piscar "—"
  await letrasJa;
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
// sem contagem nos botões: o total do filtro já aparece no título
function desenhaAbas() {
  $("#abas").innerHTML = ABAS.map(([k, l]) => `<button data-f="${k}" aria-pressed="${st.filtro === k}">${l}</button>`).join("");
}

let letraItem: string[] = []; // letra do índice de cada música, calculada uma vez
function desenhaAZ(filtro: (m: Item) => boolean) {
  const tem = new Set<string>();
  for (const m of itens) if (filtro(m)) tem.add(letraItem[m.i]);
  $("#az").innerHTML = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"]
    .map((L) => (tem.has(L) ? `<a href="#letra-${L === "#" ? "num" : L}" data-letra="${L}">${L}</a>` : `<span>${L}</span>`)).join("");
}

// pedido de música vai pro KJ (quem opera o som); sem KJ no painel, o build já pôs o Zap de contato
const zap = (ms: ItemComanda[], quem = "") =>
  `https://wa.me/${manifesto.zapKj}?text=` + encodeURIComponent(`Oi! ${quem ? quem + " quer" : "Quero"} cantar:\n` + ms.map((m) => `• ${m.cod} · ${m.tit} (${m.art})`).join("\n"));

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
  } else if (!rs.length && !exato && st.filtro !== "todas") {
    // o filtro escondeu: a música pode existir no resto do catálogo
    const nome = ABAS.find(([k]) => k === st.filtro)![1];
    h += `<div class="vazio"><h3>Não tem em ${escapa(nome)}</h3><p>Nada com “${escapa(st.q)}” nesse filtro. Procura no catálogo inteiro.</p><button class="bt" data-f="todas">Procurar em todas</button></div>`;
  } else if (!rs.length && !exato) {
    const pedido = `https://wa.me/${manifesto.zapContato}?text=` + encodeURIComponent(`Oi Ari! Procurei e não achei no catálogo: ${st.q}. Dá pra adicionar?`);
    h += `<div class="vazio"><h3>Essa ainda não tem</h3><p>Não achamos “${escapa(st.q)}”. Pede pro Ari, ele vê se entra no próximo pacote.</p><a class="bt zap" target="_blank" rel="noopener" href="${pedido}">Pedir música nova</a></div>`;
  } else if (rs.length) { // só a telinha do código exato: sem tabela vazia embaixo
    const porArt = (a: Resultado, b: Resultado) => a.item.artista.localeCompare(b.item.artista, "pt") || a.item.titulo.localeCompare(b.item.titulo, "pt");
    rs.sort(q ? (a, b) => b.nota - a.nota || porArt(a, b) : porArt);
    ordenadas = rs;
    const paginas = Math.ceil(rs.length / POR_PAGINA);
    st.pagina = Math.min(st.pagina, Math.max(0, paginas - 1));
    let L0 = "", li = "";
    for (const r of rs.slice(st.pagina * POR_PAGINA, (st.pagina + 1) * POR_PAGINA)) {
      if (!q) {
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
  desenhaAZ(filtro);
}

/* ---------- comanda ---------- */
function desenhaComanda() {
  $("#nComanda").textContent = String(comanda.length);
  $("#totalC").textContent = String(comanda.length).padStart(2, "0");
  $("#itens").innerHTML = comanda.length
    ? comanda.map((m, i) => `<li><span class="c">${m.cod}</span><span class="t">${escapa(m.tit)}<small>${escapa(m.art)}</small></span><button data-tira="${i}" aria-label="Tirar ${escapa(m.tit)}">×</button></li>`).join("")
    : `<li class="nada">Comanda vazia. Toca no + do lado de uma música pra anotar aqui.</li>`;
  // sem música não tem o que pedir: o botão fica apagado e só avisa
  const mandar = $<HTMLAnchorElement>("#mandar");
  if (comanda.length) {
    mandar.href = zap(comanda, $<HTMLInputElement>("#cantor").value.trim());
    mandar.removeAttribute("aria-disabled");
    mandar.removeAttribute("role");
    mandar.removeAttribute("tabindex");
  } else {
    mandar.removeAttribute("href");
    mandar.setAttribute("aria-disabled", "true");
    mandar.setAttribute("role", "link");
    mandar.tabIndex = 0;
  }
}
function mandarVazio(e: Event) {
  if (comanda.length) return;
  e.preventDefault();
  aviso("Põe pelo menos 1 música na comanda");
}
function abreComanda(abrir: boolean) {
  const c = $("#comanda");
  if (c.classList.contains("on") === abrir) return;
  c.classList.toggle("on", abrir);
  $("#veu").classList.toggle("on", abrir);
  // fechada, fica fora do Tab e do leitor de tela; ao fechar, o foco volta pro botão
  c.inert = !abrir;
  if (abrir) { desenhaComanda(); $("#fechaComanda").focus(); } else $("#abreComanda").focus();
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
const estreita = matchMedia("(max-width: 520px)");
const ajustaPlaceholder = () => (campo.placeholder = estreita.matches ? "Código, cantor ou letra" : "Código, cantor, música ou letra");
ajustaPlaceholder();
estreita.addEventListener("change", ajustaPlaceholder);
let espera: ReturnType<typeof setTimeout>;
campo.addEventListener("input", () => {
  clearTimeout(espera);
  espera = setTimeout(() => { st.q = campo.value; st.pagina = 0; desenha(); }, 80);
});
$("#limpa").addEventListener("click", () => { campo.value = ""; st.q = ""; st.pagina = 0; desenha(); campo.focus(); });
$("#cantor").addEventListener("input", desenhaComanda);
$("#mandar").addEventListener("click", mandarVazio);
$("#mandar").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") mandarVazio(e); });
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
    if (st.q) { st.q = ""; campo.value = ""; desenha(); }
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
  if (e.key === "ari.favoritas") { favs = new Set(ler("ari.favoritas", ehTexto)); desenha(); }
  if (e.key === "ari.comanda") { comanda = ler("ari.comanda", ehItem); desenhaComanda(); desenha(); }
});

/* ---------- busca grudada no topo ---------- */
// mede a barra pro A–Z e o cabeçalho da lista grudarem logo abaixo dela
const barra = $(".busca");
const medeBarra = () => document.documentElement.style.setProperty("--alto-busca", barra.offsetHeight + "px");
new ResizeObserver(medeBarra).observe(barra);
medeBarra();
// a sombra só aparece quando ela está grudada, pra mostrar que a lista passa por baixo
new IntersectionObserver(([e]) => barra.classList.toggle("grudada", e.intersectionRatio < 1), { threshold: 1, rootMargin: "-1px 0px 0px 0px" }).observe(barra);

desenhaComanda();
carregaCatalogo().catch(() => aviso("Não deu pra carregar o catálogo. Tenta recarregar a página."));
