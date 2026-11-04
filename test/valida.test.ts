import { describe, expect, it } from "vitest";
import {
  formataZap, idDaPlanilha, normalizaUsuario, normalizaZap, validaBanner, validaCartao, validaContato, validaNovidades,
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

describe("redes", () => {
  it.each(["@ariribeirokaraoke", "https://www.instagram.com/ariribeirokaraoke/", "ariribeirokaraoke", "facebook.com/AriRibeiroKaraoke"])("%s vira só o usuário", (s) => {
    expect(ok(normalizaUsuario(s)).toLowerCase()).toBe("ariribeirokaraoke");
  });
  it("recusa nome com espaço", () => {
    expect(normalizaUsuario("ari ribeiro").ok).toBe(false);
  });
});

describe("contato", () => {
  const base = { zapContato: "12991167274", zapKj: "", instagram: "@ariribeirokaraoke", facebook: "" };
  it("Zap do KJ vazio vira null", () => {
    expect(ok(validaContato(base))).toEqual({ zapContato: "5512991167274", zapKj: null, instagram: "ariribeirokaraoke", facebook: null });
  });
  it("Zap de contato é obrigatório", () => {
    expect(validaContato({ ...base, zapContato: "" }).ok).toBe(false);
  });
  it("Zap do KJ inválido é recusado", () => {
    expect(validaContato({ ...base, zapKj: "1234" }).ok).toBe(false);
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
