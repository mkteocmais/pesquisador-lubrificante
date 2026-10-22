import type { Lancamento, Perfil, Produto } from "../types";
import { chaveTexto } from "./format";
import { rotuloFluxo, volumeDaEmbalagem } from "./options";
import { Aba, gerarXlsx } from "./xlsx";

export interface Contexto {
  perfis: Map<string, Perfil>;
  produtos: Map<string, Produto>;
}

// Quem lançou: o nome do perfil; nos lançamentos antigos (sem login), o nome
// digitado no campo "Colaborador".
export function autorDe(l: Lancamento, perfis: Map<string, Perfil>): string {
  const p = l.user_id ? perfis.get(l.user_id) : undefined;
  return p?.nome || p?.email || l.colaborador || "—";
}

function mediana(v: number[]): number {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export interface GrupoEquivalencia {
  chave: string;
  marca: string;
  produto: string;
  viscosidades: string[];
  ids: string[];
  porEquivalente: { id: string | null; n: number }[];
  ultimo: string;
}

// Base de equivalências: cada produto de concorrente (marca + nome) e para
// qual produto nosso os vendedores o ligaram.
export function agruparEquivalencias(lancamentos: Lancamento[]): GrupoEquivalencia[] {
  const grupos = new Map<string, GrupoEquivalencia & { contagem: Map<string | null, number>; visc: Set<string> }>();
  for (const l of lancamentos) {
    if (!l.marca) continue;
    const chave = `${chaveTexto(l.marca)}|${chaveTexto(l.produto)}`;
    let g = grupos.get(chave);
    if (!g) {
      g = { chave, marca: l.marca, produto: l.produto ?? "", viscosidades: [], ids: [], porEquivalente: [], ultimo: l.created_at, contagem: new Map(), visc: new Set() };
      grupos.set(chave, g);
    }
    g.ids.push(l.id);
    g.contagem.set(l.produto_ref_id, (g.contagem.get(l.produto_ref_id) ?? 0) + 1);
    if (l.viscosidade) g.visc.add(l.viscosidade);
    if (l.created_at > g.ultimo) g.ultimo = l.created_at;
  }
  return Array.from(grupos.values())
    .map(({ contagem, visc, ...g }) => ({
      ...g,
      viscosidades: Array.from(visc),
      porEquivalente: Array.from(contagem.entries())
        .map(([id, n]) => ({ id, n }))
        .sort((a, b) => b.n - a.n),
    }))
    .sort((a, b) => b.ids.length - a.ids.length);
}

export function planilhaLancamentos(lancamentos: Lancamento[], ctx: Contexto): Blob {
  const nomeEquiv = (id: string | null) => (id ? ctx.produtos.get(id)?.nome ?? "" : "");

  const abaLancamentos: Aba = {
    nome: "Lançamentos",
    colunas: [
      { titulo: "Data", largura: 17 },
      { titulo: "Vendedor", largura: 22 },
      { titulo: "Empresa pesquisada", largura: 28 },
      { titulo: "Cidade", largura: 18 },
      { titulo: "UF", largura: 6 },
      { titulo: "Marca", largura: 16 },
      { titulo: "Produto concorrente", largura: 28 },
      { titulo: "Viscosidade", largura: 13 },
      { titulo: "Desempenho", largura: 24 },
      { titulo: "Embalagem", largura: 20 },
      { titulo: "Fluxo de venda", largura: 26 },
      { titulo: "Preço (R$)", largura: 13, formato: "moeda" },
      { titulo: "Volume", largura: 9, formato: "numero" },
      { titulo: "Unid.", largura: 7 },
      { titulo: "Preço por L/kg", largura: 14, formato: "moeda" },
      { titulo: "Equivalente Grupo Pax", largura: 40 },
      { titulo: "Tipo equivalente", largura: 12 },
      { titulo: "Foto", largura: 30 },
      { titulo: "Localização (lat, long)", largura: 24 },
      { titulo: "Corrigido em", largura: 17 },
      { titulo: "ID", largura: 38 },
    ],
    linhas: lancamentos.map((l) => {
      const emb = volumeDaEmbalagem(l.sku);
      const porUnidade = emb?.volume ? Math.round((l.preco / emb.volume) * 100) / 100 : null;
      const eq = l.produto_ref_id ? ctx.produtos.get(l.produto_ref_id) : undefined;
      return [
        new Date(l.created_at),
        autorDe(l, ctx.perfis),
        l.empresa,
        l.cidade,
        l.estado,
        l.marca,
        l.produto,
        l.viscosidade,
        l.desempenho,
        l.sku || l.unidade,
        rotuloFluxo(l.cliente),
        l.preco,
        emb?.volume ?? null,
        emb?.unidade ?? null,
        porUnidade,
        eq?.nome,
        eq?.tipo,
        l.foto_url,
        l.localizacao,
        l.updated_at ? new Date(l.updated_at) : null,
        l.id,
      ];
    }),
  };

  const grupos = agruparEquivalencias(lancamentos);
  const abaEquiv: Aba = {
    nome: "Equivalências",
    colunas: [
      { titulo: "Marca", largura: 16 },
      { titulo: "Produto concorrente", largura: 30 },
      { titulo: "Viscosidade(s)", largura: 16 },
      { titulo: "Equivalente Grupo Pax", largura: 42 },
      { titulo: "Lançamentos com este vínculo", largura: 14, formato: "numero" },
      { titulo: "Total de lançamentos do concorrente", largura: 14, formato: "numero" },
      { titulo: "Último lançamento", largura: 17 },
    ],
    linhas: grupos.flatMap((g) =>
      g.porEquivalente.map((e) => [
        g.marca,
        g.produto,
        g.viscosidades.join(", "),
        e.id ? nomeEquiv(e.id) : "(sem vínculo)",
        e.n,
        g.ids.length,
        new Date(g.ultimo),
      ])
    ),
  };

  // Resumo para análise rápida: mesmo equivalente (ou viscosidade, quando não
  // há vínculo), mesma embalagem e mesmo fluxo.
  const resumo = new Map<string, { eq: string; visc: string; emb: string; fluxo: string; uf: string; precos: number[]; porUnidade: number[]; unidade: string }>();
  for (const l of lancamentos) {
    if (!(l.preco > 0)) continue;
    const eq = nomeEquiv(l.produto_ref_id) || "(sem vínculo)";
    const visc = l.viscosidade ?? "";
    const emb = l.sku || l.unidade || "";
    const fluxo = l.cliente ?? "";
    const uf = l.estado ?? "";
    const k = [eq, l.produto_ref_id ? "" : chaveTexto(visc), chaveTexto(emb), fluxo, uf].join("|");
    const vol = volumeDaEmbalagem(emb);
    const r = resumo.get(k) ?? { eq, visc: l.produto_ref_id ? "" : visc, emb, fluxo, uf, precos: [], porUnidade: [], unidade: vol?.unidade ?? "" };
    r.precos.push(l.preco);
    if (vol) r.porUnidade.push(l.preco / vol.volume);
    resumo.set(k, r);
  }
  const abaResumo: Aba = {
    nome: "Resumo de preços",
    colunas: [
      { titulo: "Equivalente Grupo Pax", largura: 42 },
      { titulo: "Viscosidade (sem vínculo)", largura: 14 },
      { titulo: "Embalagem", largura: 20 },
      { titulo: "Fluxo de venda", largura: 26 },
      { titulo: "UF", largura: 6 },
      { titulo: "Pesquisas", largura: 10, formato: "numero" },
      { titulo: "Mínimo", largura: 13, formato: "moeda" },
      { titulo: "Mediana", largura: 13, formato: "moeda" },
      { titulo: "Média", largura: 13, formato: "moeda" },
      { titulo: "Máximo", largura: 13, formato: "moeda" },
      { titulo: "Mediana por L/kg", largura: 14, formato: "moeda" },
      { titulo: "Unid.", largura: 7 },
    ],
    linhas: Array.from(resumo.values())
      .sort((a, b) => a.eq.localeCompare(b.eq) || a.emb.localeCompare(b.emb) || a.uf.localeCompare(b.uf))
      .map((r) => [
        r.eq,
        r.visc,
        r.emb,
        rotuloFluxo(r.fluxo),
        r.uf,
        r.precos.length,
        Math.min(...r.precos),
        mediana(r.precos),
        Math.round((r.precos.reduce((s, v) => s + v, 0) / r.precos.length) * 100) / 100,
        Math.max(...r.precos),
        r.porUnidade.length ? Math.round(mediana(r.porUnidade) * 100) / 100 : null,
        r.unidade || null,
      ]),
  };

  return gerarXlsx([abaLancamentos, abaEquiv, abaResumo]);
}
