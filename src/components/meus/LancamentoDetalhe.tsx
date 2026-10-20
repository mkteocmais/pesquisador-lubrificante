import React, { useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import type { Concorrente, Lancamento, Perfil, Produto } from "../../types";
import { excluirLancamento } from "../../lib/api";
import { formatBRL, formatData } from "../../utils/format";
import { mensagemErro } from "../../utils/erros";
import { Modal } from "../common/Modal";
import { useToast } from "../common/ToastProvider";
import { DevolutivaCard } from "../lancar/DevolutivaCard";
import { LancamentoForm } from "../lancar/LancamentoForm";

interface Props {
  lancamento: Lancamento;
  perfil: Perfil;
  produtos: Produto[];
  concorrentes: Concorrente[];
  // Nome de quem lançou (o administrador vê lançamentos de todos).
  autor?: string;
  onFechar: () => void;
  onAlterado: (l: Lancamento) => void;
  onExcluido: (id: string) => void;
}

// Detalhe de um lançamento: dados, foto, retorno de preço, editar e apagar.
export function LancamentoDetalhe({ lancamento: l, perfil, produtos, concorrentes, autor, onFechar, onAlterado, onExcluido }: Props) {
  const { showError, showSuccess } = useToast();
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const equivalente = produtos.find((p) => p.id === l.produto_ref_id);

  const excluir = async () => {
    setExcluindo(true);
    try {
      await excluirLancamento(l.id);
      showSuccess("Lançamento apagado.");
      onExcluido(l.id);
    } catch (e) {
      showError(mensagemErro(e));
      setExcluindo(false);
    }
  };

  if (editando) {
    return (
      <Modal title="Corrigir lançamento" onClose={() => setEditando(false)}>
        <LancamentoForm
          perfil={perfil}
          produtos={produtos}
          concorrentes={concorrentes}
          inicial={l}
          onCancelar={() => setEditando(false)}
          onSalvo={(novo) => {
            showSuccess("Lançamento corrigido.");
            onAlterado(novo);
            setEditando(false);
          }}
        />
      </Modal>
    );
  }

  const linhas: [string, string | null | undefined][] = [
    ["Data", formatData(l.created_at, true) + (l.updated_at ? ` · corrigido em ${formatData(l.updated_at)}` : "")],
    ...(autor ? ([["Vendedor", autor]] as [string, string][]) : []),
    ["Empresa", l.empresa],
    ["Cidade", [l.cidade, l.estado].filter(Boolean).join(" / ")],
    ["Marca", l.marca],
    ["Produto", l.produto],
    ["Viscosidade", l.viscosidade],
    ["Embalagem", l.sku || l.unidade],
    ["Fluxo de venda", l.cliente?.replace("->", "→")],
    ["Equivalente Grupo Pax", equivalente?.nome ?? "Não informado"],
  ];

  return (
    <Modal title="Lançamento" onClose={onFechar}>
      <div className="space-y-5">
        <div className="text-center">
          <p className="text-3xl font-semibold text-ink tabular-nums">{formatBRL(l.preco)}</p>
          <p className="text-sm text-muted">
            {l.marca} {l.produto}
          </p>
        </div>
        <DevolutivaCard lancamento={l} equivalente={equivalente} />
        <dl className="divide-y divide-line border border-line rounded-xl">
          {linhas.map(([k, v]) => (
            <div key={k} className="px-4 py-2.5 flex justify-between gap-4 text-sm">
              <dt className="text-muted shrink-0">{k}</dt>
              <dd className="text-ink text-right">{v || "—"}</dd>
            </div>
          ))}
        </dl>
        {l.dados_originais && Object.keys(l.dados_originais).length > 0 && (
          <p className="text-xs text-muted">
            Padronizado na limpeza de dados. Original:{" "}
            {Object.entries(l.dados_originais)
              .map(([k, v]) => `${k} "${v}"`)
              .join(", ")}
            .
          </p>
        )}
        {l.foto_url && (
          <a href={l.foto_url} target="_blank" rel="noreferrer" className="block rounded-2xl overflow-hidden border border-line bg-sunken">
            <img src={l.foto_url} alt="Foto do produto pesquisado" className="w-full max-h-72 object-contain" loading="lazy" />
          </a>
        )}
        {confirmando ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-3">
            <p className="text-sm text-rose-700 font-medium">Apagar este lançamento? Não dá para desfazer.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setConfirmando(false)} className="py-3 rounded-xl bg-white border border-line text-sm font-semibold">
                Cancelar
              </button>
              <button onClick={excluir} disabled={excluindo} className="py-3 rounded-xl bg-rose-600 text-white text-sm font-semibold">
                {excluindo ? <Loader2 size={18} className="animate-spin mx-auto" /> : "Apagar"}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setEditando(true)} className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-brand-soft text-brand-ink text-sm font-semibold">
              <Pencil size={16} /> Corrigir
            </button>
            <button onClick={() => setConfirmando(true)} className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-rose-50 text-rose-700 text-sm font-semibold">
              <Trash2 size={16} /> Apagar
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
