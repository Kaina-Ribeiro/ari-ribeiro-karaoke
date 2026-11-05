/** Partes puras do build: o manifesto que o site lê e a trava contra arquivo errado. */
import { rotuloLetreiro } from "./painel/cartaz.ts";
import { blocosRodape, migraContato, numeroDoZap, type BlocoRodape } from "./painel/contato.ts";
import type { ConfigBuild } from "./painel/tipos.ts";
import { formataZap } from "./painel/valida.ts";
import type { Pacote } from "./texto.ts";
import { abaixoDaMetade } from "./xlsx.ts";

export interface BaseManifesto {
  geradoEm: string;
  total: number;
  temLetras: boolean;
  catalogo: string;
  letras: string;
  primeiras: { codigo: string; artista: string; titulo: string; pacote: Pacote; trecho: string }[];
}

export interface Manifesto extends BaseManifesto {
  /** números já resolvidos (sem escolha = o geral) e o rodapé pronto */
  contato: { zapGeral: string; zapKj: string; zapPedido: string; rodape: BlocoRodape[] };
  banner: { linhas: string[]; rotulo: string; frase: string; legenda: [string, string]; foto: { src: string; recortada: boolean } };
  servicos: { titulo: string; destaque: string; descricao: string; foto: string | null }[];
}

/** Mensagem de erro se o catálogo novo tem menos da metade das músicas no ar (e o Ari não confirmou). */
export function confereTamanho(total: number, musicasNoAr: number | null, forcar: boolean): string | null {
  if (forcar || !abaixoDaMetade(total, musicasNoAr)) return null;
  return `O catálogo novo tem ${total} músicas, menos da metade das ${musicasNoAr} que estão no ar. Confirme no painel para publicar mesmo assim.`;
}

/** `fotos`: chave no R2 → caminho da cópia em public/img/painel/. */
export function montaManifesto(base: BaseManifesto, config: ConfigBuild, fotos: Map<string, string>): Manifesto {
  const foto = (chave: string) => {
    const src = fotos.get(chave);
    if (!src) throw new Error(`A foto ${chave} não foi baixada.`);
    return src;
  };
  const { banner } = config;
  // a config offline (data/fixture) ou um build antigo ainda podem trazer o formato de antes
  const contato = migraContato(config.contato);
  return {
    ...base,
    contato: {
      zapGeral: numeroDoZap(contato, null),
      zapKj: numeroDoZap(contato, contato.kj),
      zapPedido: numeroDoZap(contato, contato.pedido),
      rodape: blocosRodape(contato, formataZap),
    },
    banner: {
      linhas: banner.linhas,
      rotulo: rotuloLetreiro(banner.linhas),
      frase: banner.frase,
      legenda: banner.legenda,
      foto: { src: foto(banner.foto.chave), recortada: banner.foto.recortada },
    },
    servicos: config.cartoes.map((c) => ({ titulo: c.titulo, destaque: c.destaque, descricao: c.descricao, foto: c.fotoChave ? foto(c.fotoChave) : null })),
  };
}

/** Extensão da cópia da foto no site, a mesma do arquivo enviado (WebP, ou JPG/PNG vindos do Safari). */
export function extensaoFoto(chave: string): "webp" | "jpg" | "png" {
  const ext = /\.(webp|jpg|png)$/.exec(chave)?.[1];
  return (ext ?? "webp") as "webp" | "jpg" | "png";
}
