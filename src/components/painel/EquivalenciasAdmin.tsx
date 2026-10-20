import React, { useMemo, useState } from "react";
import { Link2, Search } from "lucide-react";
import type { Lancamento, Produto } from "../../types";
import { atualizarVarios } from "../../lib/api";
import { agruparEquivalencias, GrupoEquivalencia } from "../../utils/exportar";
import { chaveTexto, formatData } from "../../utils/format";
import { mensagemErro } from "../../utils/erros";
import { theme } from "../../utils/theme";
import { EmptyState } from "../common/EmptyState";
import { useToast } from "../common/ToastProvider";
import { ListaProdutos } from "../lancar/ProdutoPicker";
import type { DadosPainel } from "./PainelPage";

interface Props {
  dados: DadosPainel;
  produtos: Produto[];
  onAlterados: (l: Lancamento[]) => void;
}

// Base de equivalências: cada produto de concorrente já pesquisado e o nosso
// produto que os vendedores ligaram a ele. O administrador pode vincular de uma
// vez todos os lançamentos de um concorrente (inclusive os antigos), que passam
// a contar na comparação de preço.
export function EquivalenciasAdmin({ dados, produtos, onAlterados }: Props) {
  const { showError, showSuccess } = useToast();
  const [busca, setBusca] = useState("");
  const [soSem, setSoSem] = useState(false);
  const [vinculando, setVinculando] = useState<GrupoEquivalencia | null>(null);
  const { produtosPorId, lancamentos } = dados;

  const grupos = useMemo(() => agruparEquivalencias(lancamentos), [lancamentos]);
  const filtrados = useMemo(() => {
    const termos = chaveTexto(busca).split(" ").filter(Boolean);
    return grupos.filter((g) => {
      if (soSem && !g.porEquivalente.some((e) => e.id === null)) return false;
      if (!termos.length) return true;
      const nomes = g.porEquivalente.map((e) => (e.id ? produtosPorId.get(e.id)?.nome : "")).join(" ");
      const alvo = chaveTexto(`${g.marca} ${g.produto} ${g.viscosidades.join(" ")} ${nomes}`);
      return termos.every((t) => alvo.includes(t));
    });
  }, [grupos, busca, soSem, produtosPorId]);

  const semVinculo = grupos.filter((g) => g.porEquivalente.some((e) => e.id === null)).length;

  const vincular = async (g: GrupoEquivalencia, produtoId: string | null) => {
    setVinculando(null);
    try {
      await atualizarVarios(g.ids, { produto_ref_id: produtoId });
      const ids = new Set(g.ids);
      onAlterados(lancamentos.filter((l) => ids.has(l.id)).map((l) => ({ ...l, produto_ref_id: produtoId })));
      showSuccess(`${g.ids.length} ${g.ids.length === 1 ? "lançamento atualizado" : "lançamentos atualizados"}.`);
    } catch (e) {
      showError(mensagemErro(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
        <p className="text-sm text-muted">
          {grupos.length} produtos de concorrentes pesquisados · <span className="text-amber-700">{semVinculo} com lançamentos sem equivalente</span>
        </p>
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            autoComplete="off"
            className={theme.input + " pl-11 py-2.5 text-sm"}
            placeholder="Buscar marca, produto ou equivalente..."
            aria-label="Buscar equivalências"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={soSem} onChange={(e) => setSoSem(e.target.checked)} />
          Só os que têm lançamentos sem equivalente
        </label>
      </div>

      {filtrados.length === 0 ? (
        <EmptyState title="Nada encontrado" />
      ) : (
        <ul className="bg-surface border border-line rounded-2xl divide-y divide-line overflow-hidden">
          {filtrados.slice(0, 400).map((g) => (
            <li key={g.chave} className="px-4 py-3.5 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[15px] text-ink">
                  <span className="font-semibold">{g.marca}</span> {g.produto || <span className="text-muted">(sem nome)</span>}
                </p>
                <p className="text-xs text-muted">
                  {g.viscosidades.join(", ") || "sem viscosidade"} · {g.ids.length} {g.ids.length === 1 ? "lançamento" : "lançamentos"} · último em{" "}
                  {formatData(g.ultimo)}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {g.porEquivalente.map((e) => (
                    <span
                      key={e.id ?? "sem"}
                      className={`text-xs px-2.5 py-1 rounded-full ${e.id ? "bg-brand-soft text-brand-ink" : "bg-amber-50 text-amber-700"}`}
                    >
                      {e.id ? produtosPorId.get(e.id)?.nome ?? "produto removido" : "sem equivalente"} · {e.n}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setVinculando(g)}
                className="flex items-center justify-center gap-2 text-sm font-semibold text-brand-ink bg-brand-soft px-4 py-2.5 rounded-xl shrink-0"
              >
                <Link2 size={16} /> {g.porEquivalente.some((e) => e.id) ? "Trocar vínculo" : "Vincular"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {vinculando && (
        <ListaProdutos
          titulo={`Equivalente para ${vinculando.marca} ${vinculando.produto}`}
          produtos={produtos}
          valor={vinculando.porEquivalente.find((e) => e.id)?.id ?? null}
          viscosidade={vinculando.viscosidades[0]}
          onFechar={() => setVinculando(null)}
          onEscolher={(id) => vincular(vinculando, id)}
        />
      )}
    </div>
  );
}
