import React, { useEffect, useState } from "react";
import { Loader2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { devolutiva as buscarDevolutiva } from "../../lib/api";
import type { Devolutiva, Estatistica, Lancamento, Produto } from "../../types";
import { formatBRL, formatPct, variacao } from "../../utils/format";

interface Props {
  lancamento: Lancamento;
  equivalente?: Produto;
}

interface Comparacao {
  titulo: string;
  stat: Estatistica;
}

// Faixa de ±3% em volta da mediana conta como "na média".
const TOLERANCIA = 0.03;

// O retorno ao vendedor: como o preço que ele lançou se compara com o que a
// equipe já pesquisou (mesma embalagem e mesmo fluxo de venda).
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
  }, [lancamento.id, lancamento.preco, lancamento.produto_ref_id, lancamento.sku, lancamento.cliente, lancamento.estado]);

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
  const embalagem = lancamento.sku || "mesma embalagem";
  const recortes: Comparacao[] = [];
  if (dados.equivalente) {
    const nome = equivalente ? equivalente.nome : "o mesmo equivalente";
    if (dados.equivalente.estado) recortes.push({ titulo: `Equivalentes a ${nome} em ${uf}`, stat: dados.equivalente.estado });
    if (dados.equivalente.brasil) recortes.push({ titulo: `Equivalentes a ${nome} no Brasil`, stat: dados.equivalente.brasil });
  }
  if (dados.viscosidade) {
    const v = lancamento.viscosidade;
    if (dados.viscosidade.estado) recortes.push({ titulo: `Todos ${v} em ${uf}`, stat: dados.viscosidade.estado });
    if (dados.viscosidade.brasil) recortes.push({ titulo: `Todos ${v} no Brasil`, stat: dados.viscosidade.brasil });
  }
  const comDados = recortes.filter((r) => r.stat.mediana != null);
  const principal = comDados[0];

  return (
    <div className="bg-surface border border-line rounded-lg p-5 space-y-4">
      <div>
        <p className="text-[13px] text-muted">Como está esse preço</p>
        <p className="text-xs text-muted">
          {embalagem} · {lancamento.cliente || "sem fluxo"} · últimos 12 meses
        </p>
      </div>

      {principal ? (
        <>
          <Destaque preco={lancamento.preco} comp={principal} />
          <Faixa preco={lancamento.preco} stat={principal.stat} />
          {comDados.length > 1 && (
            <ul className="divide-y divide-line border border-line rounded-md">
              {comDados.slice(1).map((r) => (
                <LinhaRecorte key={r.titulo} preco={lancamento.preco} comp={r} />
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-sm text-ink">
          Ainda há poucas pesquisas parecidas para comparar
          {recortes.length > 0 && ` (${Math.max(...recortes.map((r) => r.stat.n))} até agora)`}. Quanto mais preços a equipe
          lançar{lancamento.produto_ref_id ? "" : " com o equivalente preenchido"}, melhor fica o retorno.
        </p>
      )}
    </div>
  );
}

function Destaque({ preco, comp }: { preco: number; comp: Comparacao }) {
  const med = comp.stat.mediana ?? 0;
  const v = variacao(preco, med);
  const naMedia = Math.abs(v) <= TOLERANCIA;
  const cor = naMedia ? "text-emerald-700 bg-emerald-50" : v > 0 ? "text-amber-700 bg-amber-50" : "text-sky-700 bg-sky-50";
  const Icone = naMedia ? Minus : v > 0 ? TrendingUp : TrendingDown;
  return (
    <div className="flex items-start gap-3">
      <div className={`w-11 h-11 rounded-md flex items-center justify-center shrink-0 ${cor}`}>
        <Icone size={22} />
      </div>
      <div>
        <p className="text-[17px] font-semibold text-ink leading-snug">
          {naMedia ? "Na média do mercado" : `${formatPct(v)} ${v > 0 ? "acima" : "abaixo"} da mediana`}
        </p>
        <p className="text-sm text-muted">
          Mediana {formatBRL(med)} em {comp.stat.n} pesquisas · {comp.titulo}
        </p>
      </div>
    </div>
  );
}

// Régua do menor ao maior preço, com a mediana e o preço lançado.
function Faixa({ preco, stat }: { preco: number; stat: Estatistica }) {
  const min = Math.min(stat.minimo ?? preco, preco);
  const max = Math.max(stat.maximo ?? preco, preco);
  const pos = (v: number) => (max === min ? 50 : ((v - min) / (max - min)) * 100);
  return (
    <div className="pt-6 pb-1">
      <div className="relative h-2 rounded-full bg-sunken">
        <span
          className="absolute -top-1 w-0.5 h-4 bg-muted rounded"
          style={{ left: `${pos(stat.mediana ?? 0)}%` }}
          title="Mediana"
          aria-hidden="true"
        />
        <span
          className="absolute -top-1.5 w-5 h-5 -ml-2.5 rounded-full bg-accent border-2 border-white"
          style={{ left: `${pos(preco)}%` }}
          aria-hidden="true"
        />
        <span className="absolute -top-6 text-[11px] font-semibold text-accent -translate-x-1/2 whitespace-nowrap" style={{ left: `${Math.min(88, Math.max(12, pos(preco)))}%` }}>
          Você {formatBRL(preco)}
        </span>
      </div>
      <div className="flex justify-between text-[11px] text-muted mt-2 tabular-nums">
        <span>Menor {formatBRL(stat.minimo ?? 0)}</span>
        <span>Maior {formatBRL(stat.maximo ?? 0)}</span>
      </div>
    </div>
  );
}

function LinhaRecorte({ preco, comp }: { preco: number; comp: Comparacao }) {
  const med = comp.stat.mediana ?? 0;
  const v = variacao(preco, med);
  const txt = Math.abs(v) <= TOLERANCIA ? "na média" : `${formatPct(v)} ${v > 0 ? "acima" : "abaixo"}`;
  return (
    <li className="px-4 py-3 flex items-center justify-between gap-3">
      <span className="text-sm text-ink min-w-0">
        {comp.titulo}
        <span className="block text-xs text-muted">
          mediana {formatBRL(med)} · {comp.stat.n} pesquisas
        </span>
      </span>
      <span className="text-sm font-semibold text-ink shrink-0">{txt}</span>
    </li>
  );
}
