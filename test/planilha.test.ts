import { describe, expect, it } from "vitest";
import { comoObjetos, compacta, lerCsv, montaMusicas, montaServicos } from "../src/lib/planilha.ts";

const csv = (s: string) => comoObjetos(lerCsv(s));

describe("lerCsv", () => {
  it("entende aspas, vírgula e quebra de linha dentro do campo", () => {
    expect(lerCsv('a,b\r\n"x, y","diz ""oi""\nde novo"\n')).toEqual([
      ["a", "b"],
      ["x, y", 'diz "oi"\nde novo'],
    ]);
  });
  it("ignora linhas vazias", () => {
    expect(lerCsv("a\n\n,\nb")).toEqual([["a"], ["b"]]);
  });
});

describe("montaMusicas", () => {
  const linhas = csv(`Código,Cantor,Titulo,Trecho,Pacote,duplicado
1,A Ha,TAKE ON ME,"we're talking  away",Ari Ribeiro karaoke,FALSE
2,a-ha,HUNTING HIGH AND LOW,,INTER 14G,FALSE
1,A Ha,TAKE ON ME (REPETIDA),,,FALSE
3,Alguém,ESCONDIDA,,,TRUE
,Sem Código,NADA,,,FALSE
4,A Ha,THE SUN ALWAYS SHINES ON TV,,ARI EXCLUSIVO,FALSE`);
  const m = montaMusicas(linhas);

  it("pula duplicadas, sem código e código repetido", () => {
    expect(m.map((x) => x.codigo)).toEqual(["1", "2", "4"]);
  });
  it("junta grafias do mesmo artista na mais usada", () => {
    expect(new Set(m.map((x) => x.artista))).toEqual(new Set(["A Ha"]));
  });
  it("arruma título, pacote e espaços do trecho", () => {
    expect(m[0]).toEqual({ codigo: "1", artista: "A Ha", titulo: "Take on Me", pacote: "base", trecho: "we're talking away" });
    expect(m[1].pacote).toBe("nova");
    expect(m[2].pacote).toBe("exc");
  });
  it("junta cantor com pontuação diferente e tira da caixa alta", () => {
    const g = montaMusicas(csv(`codigo,cantor,titulo,trecho,pacote
1,Guns n´ Roses,PATIENCE,Shed a tear ´cause I´m missing you,
2,Guns n´ Roses,NOVEMBER RAIN,,
3,Guns N Roses,YESTERDAYS,,14A(Int)
4,ALICE IN CHAINS,MAN IN THE BOX,,13C`));
    expect(g.map((x) => x.artista)).toEqual(["Guns n’ Roses", "Guns n’ Roses", "Guns n’ Roses", "Alice in Chains"]);
    expect(g[0].trecho).toBe("Shed a tear ’cause I’m missing you");
  });
  it("descarta trecho que é marcador da planilha", () => {
    const g = montaMusicas(csv(`codigo,cantor,titulo,trecho,pacote
1,Abba,LAY ALL YOUR LOVE ON ME,0,14B INTER
2,Abba,DANCING QUEEN,COM VOCAIS,COM VOCAIS
3,Abba,SOS,...,
4,Abba,FERNANDO,Can you hear the drums Fernando,`));
    expect(g.map((x) => x.trecho)).toEqual(["", "", "", "Can you hear the drums Fernando"]);
  });
});

describe("compacta", () => {
  it("ordena por artista e deixa as letras alinhadas com o catálogo", () => {
    const { catalogo, letras } = compacta([
      { codigo: "9", artista: "Zezé", titulo: "B", pacote: "base", trecho: "z" },
      { codigo: "8", artista: "Ana", titulo: "A", pacote: "nova", trecho: "a" },
      { codigo: "7", artista: "Zezé", titulo: "A", pacote: "base", trecho: "y" },
    ]);
    expect(catalogo.artistas).toEqual(["Ana", "Zezé"]);
    expect(catalogo.musicas).toEqual([["8", 0, "A", "nova"], ["7", 1, "A", "base"], ["9", 1, "B", "base"]]);
    expect(letras).toEqual(["a", "y", "z"]);
  });
});

describe("montaServicos", () => {
  it("só pega os ativos e completos", () => {
    const s = montaServicos(csv(`ativo,titulo,destaque,descricao
S,Karaokê,Clássico,Som e telão
N,Velho,,Não mostra
Sim,Kit festa,,Tudo junto
S,,,Sem título`));
    expect(s.map((x) => x.titulo)).toEqual(["Karaokê", "Kit festa"]);
  });
});
