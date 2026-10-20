import React, { useMemo, useState } from "react";
import { Check, ChevronRight, Search, Sparkles, X } from "lucide-react";
import type { Produto } from "../../types";
import { chaveTexto, chaveVisc } from "../../utils/format";
import { theme } from "../../utils/theme";
import { Modal } from "../common/Modal";

interface Props {
  produtos: Produto[];
  valor: string | null;
  onChange: (id: string | null) => void;
  // Viscosidade do concorrente: os nossos produtos com a mesma vêm primeiro.
  viscosidade?: string | null;
  // Mais usados por outros vendedores para este concorrente.
  sugestoes?: { produto_id: string; usos: number }[];
  titulo?: string;
}

// Escolha do nosso produto equivalente (ex: Evora Extreme Active 15W40 para
// o Lubrax Essencial 15W40). É o vínculo que forma a base de equivalências.
export function ProdutoPicker({ produtos, valor, onChange, viscosidade, sugestoes = [], titulo = "Nosso produto equivalente" }: Props) {
  const [aberto, setAberto] = useState(false);
  const porId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);
  const selecionado = valor ? porId.get(valor) : undefined;
  const sugeridos = sugestoes.filter((s) => s.produto_id !== valor && porId.has(s.produto_id));

  return (
    <div className="space-y-2">
      <div className="relative">
        <button
          type="button"
          onClick={() => setAberto(true)}
          className={`${theme.input} flex items-center gap-3 text-left pr-12`}
        >
          <span className={`flex-1 truncate ${selecionado ? "text-ink" : "text-slate-400"}`}>
            {selecionado ? selecionado.nome : "Escolher no catálogo Grupo Pax"}
          </span>
        </button>
        {selecionado ? (
          <button
            type="button"
            aria-label="Tirar equivalente"
            onClick={() => onChange(null)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted"
          >
            <X size={18} />
          </button>
        ) : (
          <ChevronRight size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        )}
      </div>
      {sugeridos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sugeridos.map((s) => (
            <button
              key={s.produto_id}
              type="button"
              onClick={() => onChange(s.produto_id)}
              className="flex items-center gap-1.5 bg-brand-soft text-brand-ink text-xs font-medium px-3 py-2 rounded-full text-left"
            >
              <Sparkles size={14} className="shrink-0" />
              <span>
                {porId.get(s.produto_id)?.nome}{" "}
                <span className="text-muted">
                  · {s.usos} {s.usos === 1 ? "vínculo" : "vínculos"}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      {aberto && (
        <ListaProdutos
          titulo={titulo}
          produtos={produtos}
          valor={valor}
          viscosidade={viscosidade}
          onFechar={() => setAberto(false)}
          onEscolher={(id) => {
            onChange(id);
            setAberto(false);
          }}
        />
      )}
    </div>
  );
}

interface ListaProps {
  titulo: string;
  produtos: Produto[];
  valor: string | null;
  viscosidade?: string | null;
  onFechar: () => void;
  onEscolher: (id: string | null) => void;
}

export function ListaProdutos({ titulo, produtos, valor, viscosidade, onFechar, onEscolher }: ListaProps) {
  const [busca, setBusca] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const visc = chaveVisc(viscosidade);

  const lista = useMemo(() => {
    const termos = chaveTexto(busca).split(" ").filter(Boolean);
    return produtos
      .filter((p) => mostrarInativos || p.ativo || p.id === valor)
      .filter((p) => {
        if (!termos.length) return true;
        const alvo = chaveTexto(`${p.nome} ${p.especificacao ?? ""} ${p.tipo ?? ""}`);
        // "15w40" também acha "SAE 15W40" e "15W-40".
        return termos.every((t) => alvo.includes(t) || chaveVisc(alvo).includes(chaveVisc(t)));
      })
      .map((p) => ({ p, mesmaVisc: !!visc && chaveVisc(p.viscosidade) === visc }))
      .sort((a, b) => Number(b.mesmaVisc) - Number(a.mesmaVisc) || Number(b.p.ativo) - Number(a.p.ativo) || a.p.nome.localeCompare(b.p.nome))
      .slice(0, 80);
  }, [produtos, busca, visc, mostrarInativos, valor]);

  return (
    <Modal title={titulo} onClose={onFechar}>
      <div className="space-y-3">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            autoFocus
            autoComplete="off"
            className={theme.input + " pl-11"}
            placeholder="Buscar: extreme, 15w40, ci-4..."
            aria-label="Buscar produto"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        {visc && !busca && <p className="text-xs text-muted ml-1">Os de viscosidade {viscosidade} aparecem primeiro.</p>}
        <ul className="divide-y divide-line border border-line rounded-xl overflow-hidden">
          <li>
            <button type="button" onClick={() => onEscolher(null)} className="w-full text-left px-4 py-3 text-sm text-muted hover:bg-sunken">
              Não sei / sem equivalente
            </button>
          </li>
          {lista.map(({ p, mesmaVisc }) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onEscolher(p.id)}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-sunken ${p.id === valor ? "bg-brand-soft" : ""}`}
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] text-ink">{p.nome}</span>
                  <span className="block text-xs text-muted truncate">
                    {[p.tipo, p.especificacao, p.base].filter(Boolean).join(" · ")}
                    {!p.ativo && " · inativo"}
                  </span>
                </span>
                {p.id === valor ? (
                  <Check size={18} className="text-brand shrink-0 mt-0.5" />
                ) : mesmaVisc ? (
                  <span className="text-[11px] font-medium text-brand-ink bg-brand-soft px-2 py-0.5 rounded-full shrink-0">
                    mesma visc.
                  </span>
                ) : null}
              </button>
            </li>
          ))}
          {lista.length === 0 && <li className="px-4 py-6 text-sm text-muted text-center">Nenhum produto encontrado.</li>}
        </ul>
        <label className="flex items-center gap-2 text-sm text-muted ml-1">
          <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />
          Mostrar produtos inativos
        </label>
      </div>
    </Modal>
  );
}
