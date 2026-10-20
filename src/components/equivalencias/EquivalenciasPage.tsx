import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, Search } from "lucide-react";
import type { Equivalencia, Produto } from "../../types";
import { baseEquivalencias } from "../../lib/api";
import { chaveTexto, chaveVisc } from "../../utils/format";
import { theme } from "../../utils/theme";
import { EmptyState } from "../common/EmptyState";
import { TituloPagina } from "../common/Marca";

interface Props {
  produtos: Produto[];
  // Muda quando o vendedor grava um preço, para recarregar a base.
  atualizar?: number;
}

// Base de equivalências para consulta de todos: qual produto nosso concorre
// com cada produto de concorrente, montada pelos vínculos da equipe.
// Sem preço e sem quem lançou.
export function EquivalenciasPage({ produtos, atualizar }: Props) {
  const [lista, setLista] = useState<Equivalencia[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [busca, setBusca] = useState("");
  const porId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);

  useEffect(() => {
    let vivo = true;
    setFalhou(false);
    baseEquivalencias()
      .then((l) => vivo && setLista(l))
      .catch(() => vivo && setFalhou(true));
    return () => {
      vivo = false;
    };
  }, [atualizar]);

  const filtrados = useMemo(() => {
    if (!lista) return [];
    const termos = chaveTexto(busca).split(" ").filter(Boolean);
    if (!termos.length) return lista;
    return lista.filter((e) => {
      const nosso = porId.get(e.produto_id);
      const alvo = chaveTexto(`${e.marca} ${e.produto ?? ""} ${e.viscosidade ?? ""} ${nosso?.nome ?? ""} ${nosso?.especificacao ?? ""}`);
      // "15w40" também acha "SAE 15W-40".
      return termos.every((t) => alvo.includes(t) || chaveVisc(alvo).includes(chaveVisc(t)));
    });
  }, [lista, busca, porId]);

  return (
    <div className="space-y-5">
      <TituloPagina sobre="Base da equipe" titulo="Equivalências">
        <p className="text-sm text-muted pt-1">Qual produto nosso concorre com cada produto de concorrente.</p>
      </TituloPagina>

      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          autoComplete="off"
          className={theme.input + " pl-11"}
          placeholder="Buscar: lubrax, rimula, 15w40, extreme..."
          aria-label="Buscar equivalências"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {falhou ? (
        <EmptyState title="Não deu para carregar agora" description="Confira a internet e abra a aba de novo." />
      ) : !lista ? (
        <div className="flex justify-center py-16 text-muted">
          <Loader2 className="animate-spin" />
        </div>
      ) : lista.length === 0 ? (
        <EmptyState
          title="A base ainda está vazia"
          description="Ela se forma com os lançamentos que têm o equivalente preenchido. Escolha o equivalente ao lançar um preço."
        />
      ) : filtrados.length === 0 ? (
        <EmptyState title="Nada encontrado" description="Tente outra busca." />
      ) : (
        <ul className="bg-surface border border-line rounded-lg divide-y divide-line overflow-hidden">
          {filtrados.map((e) => {
            const nosso = porId.get(e.produto_id);
            return (
              <li key={`${e.marca}|${e.produto}|${e.produto_id}`} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
                <div className="sm:w-[42%] min-w-0">
                  <p className="text-[15px] text-ink">
                    <span className="font-semibold">{e.marca}</span> {e.produto}
                  </p>
                  {e.viscosidade && <p className="text-xs text-muted">{e.viscosidade}</p>}
                </div>
                <ArrowRight size={16} className="hidden sm:block text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] text-brand-ink font-medium">
                    <span className="sm:hidden text-accent">→ </span>
                    {nosso?.nome ?? "Produto fora do catálogo"}
                  </p>
                  <p className="text-xs text-muted">
                    {[nosso?.especificacao, `${e.usos} ${e.usos === 1 ? "vínculo" : "vínculos"}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
