import React, { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { devolutiva as buscarDevolutiva } from "../../lib/api";
import type { Comparacao, Devolutiva, Estatistica, Lancamento, Produto } from "../../types";
import { formatBRL, formatPct, variacao } from "../../utils/format";
import { volumeDaEmbalagem } from "../../utils/options";

interface Props {
  lancamento: Lancamento;
  equivalente?: Produto;
}

// Faixa de ±3% em volta da mediana conta como "na média".
const TOLERANCIA = 0.03;

interface Linha {
  titulo: string;
  stat: Estatistica;
  // Valor do lançamento na mesma base (por embalagem ou por litro).
  seu: number;
  porLitro: boolean;
}

// O retorno ao vendedor: como o preço lançado se compara com pesquisas
// COMPARÁVEIS. Só entram produtos ligados ao mesmo equivalente Evora (ou o
// mesmo produto do concorrente) e sempre o mesmo fluxo de venda, porque
// Fábrica -> Distribuidor (DA) e Distribuidor -> Revendedor têm preços muito
// diferentes. Mostra por embalagem (mesmo SKU) e por litro/quilo, no estado
// e no Brasil.
export function DevolutivaCard({ lancamento, equivalente }: Props) {
  const [dados, setDados] = useState<Devolutiva | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setFalhou(false);
    buscarDevolutiva(lancamento.id)
      .then((d) => vivo && setDados(d))
      .catch(() => vivo && setFalhou(true))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [lancamento.id, lancamento.preco, lancamento.produto_ref_id, lancamento.sku, lancamento.cliente, lancamento.estado, lancamento.marca, lancamento.produto]);

  if (carregando) {
    return (
      <div className="bg-surface border border-line rounded-lg p-5 flex items-center gap-3 text-sm text-muted">
        <Loader2 size={18} className="animate-spin" /> Comparando com o mercado...
      </div>
    );
  }
  if (falhou || !dados) {
    return (
      <div className="bg-surface border border-line rounded-lg p-5 text-sm text-muted">
        Não deu para comparar agora. Abra o lançamento de novo em "Meus preços" mais tarde.
      </div>
    );
  }

  const uf = lancamento.estado;
  const vol = volumeDaEmbalagem(lancamento.sku);
  const unidade = vol?.unidade ?? "L";
  const precoUnit = vol ? lancamento.preco / vol.volume : null;
  const fluxo = (lancamento.cliente || "sem fluxo").replace("->", "→");

  const linhasDe = (c: Comparacao | null): Linha[] => {
    if (!c) return [];
    const out: Linha[] = [];
    const add = (titulo: string, stat: Estatistica | null | undefined, porLitro: boolean) => {
      if (!stat) return;
      const seu = porLitro ? precoUnit : lancamento.preco;
      if (seu == null) return;
      out.push({ titulo, stat, seu, porLitro });
    };
    add(`Mesma embalagem · ${uf ?? "UF"}`, c.sku?.estado, false);
    add(`Por ${unidade === "kg" ? "quilo" : "litro"} · ${uf ?? "UF"}`, c.litro?.estado, true);
    add("Mesma embalagem · Brasil", c.sku?.brasil, false);
    add(`Por ${unidade === "kg" ? "quilo" : "litro"} · Brasil`, c.litro?.brasil, true);
    return out;
  };

  const temEquiv = !!lancamento.produto_ref_id;
  const linhasEquiv = linhasDe(dados.equivalente);
  const linhasMesmo = linhasDe(dados.mesmo_produto);
  const comDados = (ls: Linha[]) => ls.filter((l) => l.stat.mediana != null);
  // Grupo principal: equivalentes Evora; sem equivalente (ou sem dados), o
  // mesmo produto do concorrente.
  const principalEquiv = comDados(linhasEquiv).length > 0;
  const principal = principalEquiv ? comDados(linhasEquiv) : comDados(linhasMesmo);
  const destaque = principal[0];
  const nomeEquiv = equivalente?.nome ?? "o mesmo equivalente";
  const nomeMesmo = [lancamento.marca, lancamento.produto].filter(Boolean).join(" ");
  const maiorN = Math.max(0, ...[...linhasEquiv, ...linhasMesmo].map((l) => l.stat.n));

  return (
    <div className="bg-surface border border-line rounded-lg p-5 space-y-4">
      <div>
        <p className="text-[13px] text-muted">Como está esse preço</p>
        <p className="text-xs text-muted">
          {lancamento.sku || "sem embalagem"} · {fluxo} · {uf ?? "sem UF"} · últimos 12 meses
        </p>
        <p className="text-sm text-ink mt-1.5">
          Você: <b className="tabular-nums">{formatBRL(lancamento.preco)}</b>
          {precoUnit != null && (
            <span className="text-muted tabular-nums">
              {" "}
              · {formatBRL(precoUnit)}/{unidade}
            </span>
          )}
        </p>
      </div>

      {!temEquiv && (
        <div className="flex gap-2 text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-md p-3">
          <AlertTriangle size={16} className="shrink-0" />
          <span>
            Sem equivalente Evora ligado. Ligue o produto ao equivalente (botão Corrigir) para comparar com toda a linha
            similar; por enquanto a comparação é só com o mesmo produto do concorrente.
          </span>
        </div>
      )}

      {destaque ? (
        <>
          <p className="text-xs text-muted">
            Comparado com:{" "}
            <b className="text-ink">{principalEquiv ? `equivalentes à ${nomeEquiv}` : `o mesmo produto (${nomeMesmo})`}</b>, mesmo fluxo de venda
          </p>
          <Destaque linha={destaque} unidade={unidade} />
          <Faixa linha={destaque} unidade={unidade} />
          <Tabela linhas={principal} unidade={unidade} />
          {principalEquiv && comDados(linhasMesmo).length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-brand-ink font-medium text-xs">Ver também o mesmo produto ({nomeMesmo})</summary>
              <div className="mt-2">
                <Tabela linhas={comDados(linhasMesmo)} unidade={unidade} />
              </div>
            </details>
          )}
        </>
      ) : (
        <p className="text-sm text-ink">
          Ainda há poucas pesquisas comparáveis{maiorN > 0 && ` (${maiorN} até agora)`}. Para comparar são precisos ao menos 3
          preços do mesmo {temEquiv ? "equivalente" : "produto"}, no mesmo fluxo de venda.
        </p>
      )}
    </div>
  );
}

function textoVariacao(seu: number, med: number): { txt: string; v: number; naMedia: boolean } {
  const v = variacao(seu, med);
  const naMedia = Math.abs(v) <= TOLERANCIA;
  return { v, naMedia, txt: naMedia ? "na média" : `${formatPct(v)} ${v > 0 ? "acima" : "abaixo"}` };
}

function valor(n: number | undefined, porLitro: boolean, unidade: string) {
  return n == null ? "—" : `${formatBRL(n)}${porLitro ? `/${unidade}` : ""}`;
}

function Destaque({ linha, unidade }: { linha: Linha; unidade: string }) {
  const med = linha.stat.mediana ?? 0;
  const { v, naMedia, txt } = textoVariacao(linha.seu, med);
  const cor = naMedia ? "text-emerald-700 bg-emerald-50" : v > 0 ? "text-amber-700 bg-amber-50" : "text-sky-700 bg-sky-50";
  const Icone = naMedia ? Minus : v > 0 ? TrendingUp : TrendingDown;
  return (
    <div className="flex items-start gap-3">
      <div className={`w-11 h-11 rounded-md flex items-center justify-center shrink-0 ${cor}`}>
        <Icone size={22} />
      </div>
      <div>
        <p className="text-[17px] font-semibold text-ink leading-snug">{naMedia ? "Na média do mercado" : `${txt} da mediana`}</p>
        <p className="text-sm text-muted">
          Mediana {valor(med, linha.porLitro, unidade)} em {linha.stat.n} pesquisas · {linha.titulo}
        </p>
      </div>
    </div>
  );
}

// Régua do menor ao maior preço, com a mediana e o preço lançado.
function Faixa({ linha, unidade }: { linha: Linha; unidade: string }) {
  const { stat, seu } = linha;
  const min = Math.min(stat.minimo ?? seu, seu);
  const max = Math.max(stat.maximo ?? seu, seu);
  const pos = (x: number) => (max === min ? 50 : ((x - min) / (max - min)) * 100);
  return (
    <div className="pt-6 pb-1">
      <div className="relative h-2 rounded-full bg-sunken">
        <span className="absolute -top-1 w-0.5 h-4 bg-muted rounded" style={{ left: `${pos(stat.mediana ?? 0)}%` }} title="Mediana" aria-hidden="true" />
        <span
          className="absolute -top-1.5 w-5 h-5 -ml-2.5 rounded-full bg-accent border-2 border-white"
          style={{ left: `${pos(seu)}%` }}
          aria-hidden="true"
        />
        <span
          className="absolute -top-6 text-[11px] font-semibold text-accent -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${Math.min(88, Math.max(12, pos(seu)))}%` }}
        >
          Você {valor(seu, linha.porLitro, unidade)}
        </span>
      </div>
      <div className="flex justify-between text-[11px] text-muted mt-2 tabular-nums">
        <span>Menor {valor(stat.minimo, linha.porLitro, unidade)}</span>
        <span>Maior {valor(stat.maximo, linha.porLitro, unidade)}</span>
      </div>
    </div>
  );
}

function Tabela({ linhas, unidade }: { linhas: Linha[]; unidade: string }) {
  return (
    <div className="border border-line rounded-md overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-sunken text-muted">
          <tr>
            <th className="text-left font-medium px-3 py-2">Comparação</th>
            <th className="text-right font-medium px-2 py-2">Mediana</th>
            <th className="text-right font-medium px-2 py-2 hidden sm:table-cell">Faixa</th>
            <th className="text-right font-medium px-2 py-2">Pesq.</th>
            <th className="text-right font-medium px-3 py-2">Você</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {linhas.map((l) => {
            const { txt, naMedia, v } = textoVariacao(l.seu, l.stat.mediana ?? 0);
            return (
              <tr key={l.titulo}>
                <td className="px-3 py-2 text-ink">{l.titulo}</td>
                <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">{valor(l.stat.mediana, l.porLitro, unidade)}</td>
                <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap text-muted hidden sm:table-cell">
                  {valor(l.stat.minimo, l.porLitro, unidade)} – {valor(l.stat.maximo, l.porLitro, unidade)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{l.stat.n}</td>
                <td
                  className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${
                    naMedia ? "text-emerald-700" : v > 0 ? "text-amber-700" : "text-sky-700"
                  }`}
                >
                  {txt}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
