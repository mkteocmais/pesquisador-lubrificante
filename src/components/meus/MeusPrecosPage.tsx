import React, { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import type { Concorrente, Lancamento, Perfil, Produto } from "../../types";
import { chaveTexto, formatBRL, formatData } from "../../utils/format";
import { theme, textStyles } from "../../utils/theme";
import { EmptyState } from "../common/EmptyState";
import { TituloPagina } from "../common/Marca";
import { LancamentoDetalhe } from "./LancamentoDetalhe";

interface Props {
  perfil: Perfil;
  produtos: Produto[];
  concorrentes: Concorrente[];
  lancamentos: Lancamento[] | null;
  onAlterado: (l: Lancamento) => void;
  onExcluido: (id: string) => void;
  onLancar: () => void;
}

type Periodo = "30" | "90" | "tudo";

export function LancamentoItem({ l, equivalente, autor, onClick }: { l: Lancamento; equivalente?: string; autor?: string; onClick: () => void }) {
  return (
    <li>
      <button onClick={onClick} className="w-full text-left px-4 py-3.5 flex items-start gap-3 hover:bg-sunken transition-colors">
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] text-ink truncate">
            {l.marca} {l.produto} {l.viscosidade && <span className="text-muted">· {l.viscosidade}</span>}
          </span>
          <span className="block text-xs text-muted truncate">
            {[l.sku || l.unidade, l.empresa, [l.cidade, l.estado].filter(Boolean).join("/")].filter(Boolean).join(" · ")}
          </span>
          <span className="block text-xs truncate mt-0.5">
            {equivalente ? <span className="text-brand-ink">≈ {equivalente}</span> : <span className="text-amber-700">sem equivalente</span>}
            {autor && <span className="text-muted"> · {autor}</span>}
          </span>
        </span>
        <span className="text-right shrink-0">
          <span className="block text-[15px] font-semibold text-ink tabular-nums">{formatBRL(l.preco)}</span>
          <span className="block text-xs text-muted">{formatData(l.created_at)}</span>
        </span>
      </button>
    </li>
  );
}

// "Meus preços": tudo o que o vendedor lançou, com busca, período e o retorno
// de preço de cada um.
export function MeusPrecosPage({ perfil, produtos, concorrentes, lancamentos, onAlterado, onExcluido, onLancar }: Props) {
  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("90");
  const [aberto, setAberto] = useState<Lancamento | null>(null);
  const nomeProduto = useMemo(() => new Map(produtos.map((p) => [p.id, p.nome])), [produtos]);

  const filtrados = useMemo(() => {
    if (!lancamentos) return [];
    const limite = periodo === "tudo" ? 0 : Date.now() - Number(periodo) * 86400000;
    const termos = chaveTexto(busca).split(" ").filter(Boolean);
    return lancamentos.filter((l) => {
      if (limite && new Date(l.created_at).getTime() < limite) return false;
      if (!termos.length) return true;
      const alvo = chaveTexto(
        [l.marca, l.produto, l.viscosidade, l.empresa, l.cidade, l.sku, l.produto_ref_id ? nomeProduto.get(l.produto_ref_id) : ""].join(" ")
      );
      return termos.every((t) => alvo.includes(t));
    });
  }, [lancamentos, busca, periodo, nomeProduto]);

  const resumo = useMemo(() => {
    const lista = lancamentos ?? [];
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const doMes = lista.filter((l) => new Date(l.created_at) >= inicioMes).length;
    const comEquiv = lista.filter((l) => l.produto_ref_id).length;
    return { doMes, total: lista.length, comEquiv };
  }, [lancamentos]);

  if (!lancamentos) {
    return (
      <div className="flex justify-center py-20 text-muted">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <TituloPagina sobre="Histórico" titulo="Meus preços" />

      <div className="grid grid-cols-3 gap-3">
        {[
          ["Neste mês", resumo.doMes],
          ["No total", resumo.total],
          ["Com equivalente", resumo.total ? `${Math.round((resumo.comEquiv / resumo.total) * 100)}%` : "—"],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface border border-line rounded-lg p-3">
            <p className="text-xs text-muted">{k}</p>
            <p className="text-xl font-semibold text-ink tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      {lancamentos.length === 0 ? (
        <EmptyState
          title="Nenhum preço lançado ainda"
          description="Os preços que você lançar aparecem aqui, com a comparação com o mercado."
          action={
            <button onClick={onLancar} className="bg-brand text-white px-6 py-3 rounded-md text-sm font-semibold">
              Lançar o primeiro
            </button>
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                autoComplete="off"
                className={theme.input + " pl-11"}
                placeholder="Buscar marca, produto, empresa..."
                aria-label="Buscar nos meus preços"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {(
                [
                  ["30", "30 dias"],
                  ["90", "90 dias"],
                  ["tudo", "Tudo"],
                ] as [Periodo, string][]
              ).map(([v, rotulo]) => (
                <button
                  key={v}
                  onClick={() => setPeriodo(v)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border ${
                    periodo === v ? "bg-brand text-white border-brand" : "bg-surface text-ink border-line"
                  }`}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </div>
          {filtrados.length === 0 ? (
            <EmptyState title="Nada encontrado" description="Tente outro período ou outra busca." />
          ) : (
            <ul className="bg-surface border border-line rounded-lg divide-y divide-line overflow-hidden">
              {filtrados.map((l) => (
                <LancamentoItem
                  key={l.id}
                  l={l}
                  equivalente={l.produto_ref_id ? nomeProduto.get(l.produto_ref_id) : undefined}
                  onClick={() => setAberto(l)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {aberto && (
        <LancamentoDetalhe
          lancamento={aberto}
          perfil={perfil}
          produtos={produtos}
          concorrentes={concorrentes}
          onFechar={() => setAberto(null)}
          onAlterado={(novo) => {
            onAlterado(novo);
            setAberto(novo);
          }}
          onExcluido={(id) => {
            onExcluido(id);
            setAberto(null);
          }}
        />
      )}
    </div>
  );
}
