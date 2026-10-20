import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import type { Concorrente, Lancamento, Perfil, Produto } from "../../types";
import { carregarPerfis, todosLancamentos } from "../../lib/api";
import { mensagemErro } from "../../utils/erros";
import { textStyles } from "../../utils/theme";
import { useToast } from "../common/ToastProvider";
import { TituloPagina } from "../common/Marca";
import { EquivalenciasAdmin } from "./EquivalenciasAdmin";
import { LancamentosAdmin } from "./LancamentosAdmin";
import { VendedoresAdmin } from "./VendedoresAdmin";

type Sub = "lancamentos" | "equivalencias" | "vendedores";

interface Props {
  perfil: Perfil;
  produtos: Produto[];
  concorrentes: Concorrente[];
}

export interface DadosPainel {
  lancamentos: Lancamento[];
  perfis: Perfil[];
  perfisPorId: Map<string, Perfil>;
  produtosPorId: Map<string, Produto>;
}

// Painel do administrador (pensado para o computador, mas funciona no celular):
// todos os lançamentos com filtros e download em Excel, a base de
// equivalências e os vendedores.
export function PainelPage({ perfil, produtos, concorrentes }: Props) {
  const { showError } = useToast();
  const [sub, setSub] = useState<Sub>("lancamentos");
  const [lancamentos, setLancamentos] = useState<Lancamento[] | null>(null);
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [carregando, setCarregando] = useState(false);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [l, p] = await Promise.all([todosLancamentos(), carregarPerfis()]);
      setLancamentos(l);
      setPerfis(p);
    } catch (e) {
      showError(mensagemErro(e, "Não foi possível carregar os dados do painel."));
    } finally {
      setCarregando(false);
    }
  }, [showError]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const dados: DadosPainel | null = useMemo(
    () =>
      lancamentos && {
        lancamentos,
        perfis,
        perfisPorId: new Map(perfis.map((p) => [p.id, p])),
        produtosPorId: new Map(produtos.map((p) => [p.id, p])),
      },
    [lancamentos, perfis, produtos]
  );

  const atualizarLocal = (alterados: Lancamento[]) =>
    setLancamentos((atual) => {
      if (!atual) return atual;
      const porId = new Map(alterados.map((l) => [l.id, l]));
      return atual.map((l) => porId.get(l.id) ?? l);
    });

  const abas: [Sub, string][] = [
    ["lancamentos", "Lançamentos"],
    ["equivalencias", "Gerir equivalências"],
    ["vendedores", "Vendedores"],
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <TituloPagina sobre="Administrador" titulo="Painel" />
        <button
          onClick={recarregar}
          disabled={carregando}
          className="flex items-center gap-2 text-sm font-semibold text-brand-ink px-3 py-2 rounded-md hover:bg-brand-soft"
        >
          <RefreshCw size={16} className={carregando ? "animate-spin" : ""} /> Atualizar
        </button>
      </div>
      <div className="flex gap-1 bg-sunken p-1 rounded-md w-full md:w-fit overflow-x-auto no-scrollbar">
        {abas.map(([k, rotulo]) => (
          <button
            key={k}
            onClick={() => setSub(k)}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
              sub === k ? "bg-surface text-ink border border-line" : "text-muted"
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {!dados ? (
        <div className="flex justify-center py-20 text-muted">
          <Loader2 className="animate-spin" />
        </div>
      ) : sub === "lancamentos" ? (
        <LancamentosAdmin
          dados={dados}
          perfil={perfil}
          produtos={produtos}
          concorrentes={concorrentes}
          onAlterado={(l) => atualizarLocal([l])}
          onExcluido={(id) => setLancamentos((atual) => atual && atual.filter((l) => l.id !== id))}
        />
      ) : sub === "equivalencias" ? (
        <EquivalenciasAdmin dados={dados} produtos={produtos} onAlterados={atualizarLocal} />
      ) : (
        <VendedoresAdmin dados={dados} perfil={perfil} onAlterados={atualizarLocal} onPerfisAlterados={recarregar} />
      )}
    </div>
  );
}
