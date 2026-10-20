import React, { useEffect, useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import type { RankingLinha } from "../../types";
import { rankingEnvios } from "../../lib/api";
import { textStyles } from "../../utils/theme";

type Periodo = "mes" | "total";
// Mostra o topo; quem está fora dele aparece numa linha extra, com a posição.
const TOPO = 10;

// Ranking de quem mais enviou preços. Todos os vendedores veem; não mostra
// preço nenhum, só a quantidade de envios.
export function RankingEnvios({ atualizar }: { atualizar?: number }) {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [linhas, setLinhas] = useState<RankingLinha[] | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let vivo = true;
    setLinhas(null);
    setFalhou(false);
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    rankingEnvios(periodo === "mes" ? inicioMes : null)
      .then((r) => vivo && setLinhas(r))
      .catch(() => vivo && setFalhou(true));
    return () => {
      vivo = false;
    };
  }, [periodo, atualizar]);

  const minhaPosicao = linhas ? linhas.findIndex((l) => l.eu) : -1;
  const visiveis = linhas ? linhas.slice(0, TOPO) : [];

  return (
    <section className="bg-surface border border-line rounded-lg overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <h2 className={`${textStyles.section} flex items-center gap-2`}>
          <Trophy size={16} className="text-accent" /> Ranking de envios
        </h2>
        <div className="flex bg-sunken p-0.5 rounded-md text-xs">
          {(
            [
              ["mes", "Este mês"],
              ["total", "Total"],
            ] as [Periodo, string][]
          ).map(([v, rotulo]) => (
            <button
              key={v}
              onClick={() => setPeriodo(v)}
              className={`px-2.5 py-1 rounded ${periodo === v ? "bg-surface text-ink font-medium border border-line" : "text-muted"}`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>
      {falhou ? (
        <p className="px-4 pb-4 text-sm text-muted">Não deu para carregar o ranking agora.</p>
      ) : !linhas ? (
        <div className="flex justify-center pb-5 text-muted">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : linhas.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-muted">Nenhum preço enviado neste período ainda.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-sunken text-xs text-muted">
            <tr>
              <th className="text-left font-medium px-4 py-2 w-10">#</th>
              <th className="text-left font-medium py-2">Vendedor</th>
              <th className="text-right font-medium px-4 py-2">Preços enviados</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visiveis.map((l, i) => (
              <Linha key={l.vendedor} pos={i + 1} l={l} />
            ))}
            {minhaPosicao >= TOPO && <Linha pos={minhaPosicao + 1} l={linhas[minhaPosicao]} />}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Linha({ pos, l }: { pos: number; l: RankingLinha }) {
  return (
    <tr className={l.eu ? "bg-brand-soft" : ""}>
      <td className={`px-4 py-2 tabular-nums ${pos <= 3 ? "font-bold text-accent" : "text-muted"}`}>{pos}</td>
      <td className="py-2 text-ink">
        {l.vendedor}
        {l.eu && <span className="ml-1.5 text-[11px] font-semibold text-brand-ink">(você)</span>}
      </td>
      <td className="px-4 py-2 text-right font-semibold tabular-nums">{l.envios.toLocaleString("pt-BR")}</td>
    </tr>
  );
}
