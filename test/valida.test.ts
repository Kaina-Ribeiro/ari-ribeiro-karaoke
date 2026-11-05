import { describe, expect, it } from "vitest";
import {
  campoDoErro, formataZap, idDaPlanilha, mascaraZap, normalizaUsuario, normalizaZap, validaBanner, validaCartao, validaContato, validaNovidades,
} from "../src/lib/painel/valida.ts";
import { CONFIG_PADRAO } from "../src/lib/painel/padrao.ts";

const ok = <T>(r: { ok: boolean; valor?: T; erro?: string }) => {
  if (!r.ok) throw new Error("esperava ok, veio: " + r.erro);
  return r.valor as T;
};
const erroDe = (r: { ok: boolean; erro?: string }) => (r.ok ? "(passou)" : r.erro);

describe("Zap", () => {
  it.each(["+55 (12) 99116-7274", "12991167274", "012 99116 7274", "5512991167274", " (12)99116.7274 "])("%s vira 5512991167274", (s) => {
    expect(ok(normalizaZap(s))).toBe("5512991167274");
  });
  it("recusa fixo e DDD inválido com mensagem clara", () => {
    expect(erroDe(normalizaZap("1233334444"))).toBe("Use um celular com DDD: (12) 99999-9999");
    expect(normalizaZap("00991167274").ok).toBe(false);
    expect(normalizaZap("").ok).toBe(false);
  });
  it("mostra no formato brasileiro", () => {
    expect(formataZap("5512991167274")).toBe("(12) 99116-7274");
  });
});

describe("máscara do telefone (enquanto digita)", () => {
  it.each([
    ["", ""], ["1", "(1"], ["12", "(12"], ["129", "(12) 9"], ["1299119", "(12) 99119"], ["12991196", "(12) 99119-6"],
    ["12991196050", "(12) 99119-6050"], ["129911960509", "(12) 99119-6050"],
    ["+55 12 99119-6050", "(12) 99119-6050"], ["5512991196050", "(12) 99119-6050"], ["012991196050", "(12) 99119-6050"],
    ["(12) 99119-6050", "(12) 99119-6050"], ["(12", "(12"], ["(12) ", "(12"], ["abc", ""],
  ])("%j → %j", (entrada, saida) => {
    expect(mascaraZap(entrada)).toBe(saida);
  });
  it("DDD 55 não é confundido com o +55", () => {
    expect(mascaraZap("55991196050")).toBe("(55) 99119-6050");
  });
});

describe("redes", () => {
  it.each([
    "@ariribeirokaraoke", "https://www.instagram.com/ariribeirokaraoke/", "ariribeirokaraoke", "facebook.com/AriRibeiroKaraoke",
    "https://x.com/ariribeirokaraoke", "twitter.com/ariribeirokaraoke", "https://www.tiktok.com/@ariribeirokaraoke?lang=pt-BR",
    "youtube.com/@AriRibeiroKaraoke", "m.facebook.com/ariribeirokaraoke/",
  ])("%s vira só o usuário", (s) => {
    expect(ok(normalizaUsuario(s)).toLowerCase()).toBe("ariribeirokaraoke");
  });
  it("recusa nome com espaço", () => {
    expect(normalizaUsuario("ari ribeiro").ok).toBe(false);
  });
});

describe("contato", () => {
  const base = {
    zaps: [
      { id: "z1", nome: " WhatsApp - Ana Paula ", numero: "(12) 99119-6050", ativo: true },
      { id: "z2", nome: "WhatsApp - Ari", numero: "12991167274", ativo: false },
    ],
    geral: "z1", kj: "z2", pedido: "",
    redes: [
      { id: "r1", rede: "instagram", usuario: "@ariribeirokaraoke", ativo: true },
      { id: "r2", rede: "facebook", usuario: "facebook.com/ariribeiro", ativo: false },
    ],
  };
  const comZap = (i: number, mudanca: object) => ({ ...base, zaps: base.zaps.map((z, j) => (j === i ? { ...z, ...mudanca } : z)) });
  const erro = (x: unknown) => campoDoErro(erroDe(validaContato(x))!);

  it("normaliza números, nomes e usuários; pedido vazio vira null (= geral)", () => {
    expect(ok(validaContato(base))).toEqual({
      zaps: [
        { id: "z1", nome: "WhatsApp - Ana Paula", numero: "5512991196050", ativo: true },
        { id: "z2", nome: "WhatsApp - Ari", numero: "5512991167274", ativo: false },
      ],
      geral: "z1", kj: "z2", pedido: null,
      redes: [
        { id: "r1", rede: "instagram", usuario: "ariribeirokaraoke", ativo: true },
        { id: "r2", rede: "facebook", usuario: "ariribeiro", ativo: false },
      ],
    });
  });
  it("o geral sempre aparece no rodapé, e escolher o geral como destino vira null", () => {
    const c = ok<{ zaps: { ativo: boolean }[]; kj: string | null; pedido: string | null }>(validaContato({ ...comZap(0, { ativo: false }), kj: "z1", pedido: "z1" }));
    expect(c.zaps[0].ativo).toBe(true);
    expect([c.kj, c.pedido]).toEqual([null, null]);
  });
  it("número inválido aponta o campo do número certo", () => {
    expect(erro(comZap(1, { numero: "1234" }))).toEqual({ campo: "zap-numero-z2", mensagem: "Use um celular com DDD: (12) 99999-9999" });
  });
  it("nome é obrigatório e tem limite", () => {
    expect(erro(comZap(1, { nome: "  " })).campo).toBe("zap-nome-z2");
    expect(erro(comZap(1, { nome: "x".repeat(41) })).mensagem).toBe("O nome pode ter até 40 letras");
  });
  it("número repetido é recusado", () => {
    expect(erro(comZap(1, { numero: "12991196050" }))).toEqual({ campo: "zap-numero-z2", mensagem: "Esse número já está na lista" });
  });
  it("precisa de pelo menos um WhatsApp e de um geral que exista", () => {
    expect(erroDe(validaContato({ ...base, zaps: [] }))).toBe("Cadastre pelo menos um WhatsApp");
    expect(erroDe(validaContato({ ...base, geral: "z9" }))).toBe("Escolha qual WhatsApp é o geral");
  });
  it("destino que sumiu da lista é recusado no campo do destino", () => {
    expect(erro({ ...base, pedido: "z9" })).toEqual({ campo: "pedido", mensagem: "Escolha de novo quem recebe o pedido de música nova" });
  });
  it("ids repetidos ou rede desconhecida: lista errada", () => {
    expect(erroDe(validaContato(comZap(1, { id: "z1" })))).toBe("A lista de WhatsApp veio errada. Recarregue a página.");
    expect(erroDe(validaContato({ ...base, redes: [{ id: "r1", rede: "orkut", usuario: "ari", ativo: true }] }))).toBe("A lista de redes veio errada. Recarregue a página.");
  });
  it("usuário de rede inválido aponta o campo e diz qual rede", () => {
    expect(erro({ ...base, redes: [{ id: "r7", rede: "tiktok", usuario: "ari ribeiro", ativo: true }] }))
      .toEqual({ campo: "rede-r7", mensagem: "TikTok: Use só o nome de usuário, sem espaços (ex.: ariribeirokaraoke)" });
  });
  it("mais de um perfil da mesma rede", () => {
    const c = ok<{ redes: { usuario: string }[] }>(validaContato({ ...base, redes: [{ id: "a", rede: "youtube", usuario: "@um", ativo: true }, { id: "b", rede: "youtube", usuario: "dois", ativo: true }] }));
    expect(c.redes.map((r) => r.usuario)).toEqual(["um", "dois"]);
  });
});

describe("banner", () => {
  const b = CONFIG_PADRAO.banner;
  it("o banner de hoje passa", () => {
    expect(ok(validaBanner(b))).toEqual(b);
  });
  it("cada linha da frase grande tem até 14 letras, contando acento como uma", () => {
    expect(erroDe(validaBanner({ ...b, linhas: ["Quinze letras!!", "", ""] }))).toBe("A linha 1 pode ter até 14 letras");
    expect(validaBanner({ ...b, linhas: ["Canção é nossa", "", ""] }).ok).toBe(true);
    expect(validaBanner({ ...b, linhas: ["Canção é nossa", "", ""] }).ok).toBe(true); // acento decomposto (macOS)
  });
  it("linha 1 e frase de baixo são obrigatórias", () => {
    expect(validaBanner({ ...b, linhas: ["", "a", "b"] }).ok).toBe(false);
    expect(validaBanner({ ...b, frase: "  " }).ok).toBe(false);
  });
  it("frase de baixo até 80 e legenda até 16 e 30", () => {
    expect(validaBanner({ ...b, frase: "x".repeat(81) }).ok).toBe(false);
    expect(validaBanner({ ...b, legenda: ["x".repeat(17), "ok"] }).ok).toBe(false);
    expect(validaBanner({ ...b, legenda: ["ok", "x".repeat(31)] }).ok).toBe(false);
  });
  it("exige foto", () => {
    expect(validaBanner({ ...b, foto: null }).ok).toBe(false);
  });
});

describe("cartão", () => {
  const c = { titulo: "Aluguel de Telão", destaque: "X BOX", descricao: "Data show para eventos.", ativo: true, fotoChave: null };
  it("passa e guarda os campos", () => {
    expect(ok(validaCartao(c))).toEqual(c);
  });
  it("limites e obrigatórios", () => {
    expect(validaCartao({ ...c, titulo: "x".repeat(41) }).ok).toBe(false);
    expect(validaCartao({ ...c, destaque: "x".repeat(31) }).ok).toBe(false);
    expect(validaCartao({ ...c, descricao: "x".repeat(161) }).ok).toBe(false);
    expect(validaCartao({ ...c, descricao: "" }).ok).toBe(false);
    expect(validaCartao({ ...c, titulo: " " }).ok).toBe(false);
  });
});

describe("novidades", () => {
  it("prazo de 1 a 365 dias, inteiro", () => {
    expect(ok(validaNovidades({ prazoDias: 30 }))).toEqual({ prazoDias: 30 });
    expect(validaNovidades({ prazoDias: 0 }).ok).toBe(false);
    expect(validaNovidades({ prazoDias: 366 }).ok).toBe(false);
    expect(validaNovidades({ prazoDias: 2.5 }).ok).toBe(false);
  });
});

describe("link da planilha", () => {
  it("aceita só docs.google.com/spreadsheets/d/<id>", () => {
    expect(idDaPlanilha("https://docs.google.com/spreadsheets/d/1kTKJlUTVK0CX6pM_mRugkmqIu9Hz9Wpx/edit#gid=0")).toBe("1kTKJlUTVK0CX6pM_mRugkmqIu9Hz9Wpx");
    expect(idDaPlanilha("https://evil.com/spreadsheets/d/1kTKJlUTVK0CX6pM_mRugkmqIu9Hz9Wpx")).toBeNull();
    expect(idDaPlanilha("http://docs.google.com.evil.com/spreadsheets/d/1kTKJlUTVK0CX6pM_mRugkmqIu9Hz9Wpx")).toBeNull();
    expect(idDaPlanilha("não é link")).toBeNull();
  });
});
