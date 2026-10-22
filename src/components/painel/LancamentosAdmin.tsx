import React, { useMemo, useState } from "react";
import { Download, Search, X } from "lucide-react";
import type { Cadastros, Lancamento, Perfil, Produto } from "../../types";
import { chaveTexto, dataLocalISO, formatBRL, formatData } from "../../utils/format";
import { autorDe, planilhaLancamentos } from "../../utils/exportar";
import { baixarArquivo } from "../../utils/xlsx";
import { theme } from "../../utils/theme";
import { EmptyState } from "../common/EmptyState";
import { ListaRolavel, usarLote } from "../common/ListaRolavel";
import { LancamentoDetalhe } from "../meus/LancamentoDetalhe";
import { LancamentoItem } from "../meus/MeusPrecosPage";
import type { DadosPainel } from "./PainelPage";

interface Props {
  dados: DadosPainel;
  perfil: Perfil;
  produtos: Produto[];
  cadastros: Cadastros;
  onAlterado: (l: Lancamento) => void;
  onExcluido: (id: string) => void;
}

interface Filtros {
  de: string;
  ate: string;
  vendedor: string;
  uf: string;
  marca: string;
  equivalente: string;
  fluxo: string;
  embalagem: string;
  busca: string;
}

const VAZIO: Filtros = { de: "", ate: "", vendedor: "", uf: "", marca: "", equivalente: "", fluxo: "", embalagem: "", busca: "" };
const SEM = "__sem__";

function opcoes(valores: (string | null | undefined)[]): string[] {
  const vistos = new Map<string, string>();
  for (const v of valores) {
    const k = chaveTexto(v);
    if (k && !vistos.has(k)) vistos.set(k, (v as string).trim());
  }
  return Array.from(vistos.values()).sort((a, b) => a.localeCompare(b));
}

export function LancamentosAdmin({ dados, perfil, produtos, cadastros, onAlterado, onExcluido }: Props) {
  const [f, setF] = useState<Filtros>(VAZIO);
  const [aberto, setAberto] = useState<Lancamento | null>(null);
  const { lancamentos, perfisPorId, produtosPorId } = dados;
  const set = (campo: keyof Filtros) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [campo]: e.target.value });

  const listas = useMemo(
    () => ({
      vendedores: opcoes(lancamentos.map((l) => autorDe(l, perfisPorId))),
      ufs: opcoes(lancamentos.map((l) => l.estado)),
      marcas: opcoes(lancamentos.map((l) => l.marca)),
      fluxos: opcoes(lancamentos.map((l) => l.cliente)),
      embalagens: opcoes(lancamentos.map((l) => l.sku || l.unidade)),
      equivalentes: Array.from(new Set(lancamentos.map((l) => l.produto_ref_id).filter((x): x is string => !!x)))
        .map((id) => ({ id, nome: produtosPorId.get(id)?.nome ?? id }))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    }),
    [lancamentos, perfisPorId, produtosPorId]
  );

  const filtrados = useMemo(() => {
    const termos = chaveTexto(f.busca).split(" ").filter(Boolean);
    return lancamentos.filter((l) => {
      const dia = dataLocalISO(new Date(l.created_at));
      if (f.de && dia < f.de) return false;
      if (f.ate && dia > f.ate) return false;
      if (f.vendedor && chaveTexto(autorDe(l, perfisPorId)) !== chaveTexto(f.vendedor)) return false;
      if (f.uf && chaveTexto(l.estado) !== chaveTexto(f.uf)) return false;
      if (f.marca && chaveTexto(l.marca) !== chaveTexto(f.marca)) return false;
      if (f.fluxo && chaveTexto(l.cliente) !== chaveTexto(f.fluxo)) return false;
      if (f.embalagem && chaveTexto(l.sku || l.unidade) !== chaveTexto(f.embalagem)) return false;
      if (f.equivalente === SEM && l.produto_ref_id) return false;
      if (f.equivalente && f.equivalente !== SEM && l.produto_ref_id !== f.equivalente) return false;
      if (termos.length) {
        const alvo = chaveTexto([l.marca, l.produto, l.empresa, l.cidade, l.viscosidade, l.desempenho, l.colaborador].join(" "));
        if (!termos.every((t) => alvo.includes(t))) return false;
      }
      return true;
    });
  }, [lancamentos, f, perfisPorId]);

  const { limite, aoRolar } = usarLote(filtrados.length, f);

  const kpis = useMemo(() => {
    const vendedores = new Set(filtrados.map((l) => chaveTexto(autorDe(l, perfisPorId))));
    const marcas = new Set(filtrados.map((l) => chaveTexto(l.marca)).filter(Boolean));
    const comEq = filtrados.filter((l) => l.produto_ref_id).length;
    return [
      ["Lançamentos", filtrados.length.toLocaleString("pt-BR")],
      ["Vendedores", vendedores.size],
      ["Marcas", marcas.size],
      ["Com equivalente", filtrados.length ? `${Math.round((comEq / filtrados.length) * 100)}%` : "—"],
    ];
  }, [filtrados, perfisPorId]);

  const exportar = () => {
    const blob = planilhaLancamentos(filtrados, { perfis: perfisPorId, produtos: produtosPorId });
    baixarArquivo(`pesquisa-precos-${dataLocalISO(new Date())}.xlsx`, blob);
  };

  const temFiltro = Object.values(f).some(Boolean);
  const sel = theme.select + " py-2.5 text-sm";
  const nomeEq = (id: string | null) => (id ? produtosPorId.get(id)?.nome : undefined);

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-line rounded-lg p-4 space-y-3">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            autoComplete="off"
            className={theme.input + " pl-11 py-2.5 text-sm"}
            placeholder="Buscar marca, produto, empresa, cidade..."
            aria-label="Buscar lançamentos"
            value={f.busca}
            onChange={set("busca")}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
          <label className="text-xs text-muted">
            De
            <input type="date" className={sel} value={f.de} onChange={set("de")} />
          </label>
          <label className="text-xs text-muted">
            Até
            <input type="date" className={sel} value={f.ate} onChange={set("ate")} />
          </label>
          <select aria-label="Vendedor" className={sel + " self-end"} value={f.vendedor} onChange={set("vendedor")}>
            <option value="">Vendedor: todos</option>
            {listas.vendedores.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select aria-label="UF" className={sel + " self-end"} value={f.uf} onChange={set("uf")}>
            <option value="">UF: todas</option>
            {listas.ufs.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select aria-label="Marca" className={sel + " self-end"} value={f.marca} onChange={set("marca")}>
            <option value="">Marca: todas</option>
            {listas.marcas.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select aria-label="Equivalente" className={sel + " self-end"} value={f.equivalente} onChange={set("equivalente")}>
            <option value="">Equivalente: todos</option>
            <option value={SEM}>Sem equivalente</option>
            {listas.equivalentes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
          <select aria-label="Fluxo de venda" className={sel + " self-end"} value={f.fluxo} onChange={set("fluxo")}>
            <option value="">Fluxo: todos</option>
            {listas.fluxos.map((v) => (
              <option key={v} value={v}>
                {v.replace("->", "→")}
              </option>
            ))}
          </select>
          <select aria-label="Embalagem" className={sel + " self-end"} value={f.embalagem} onChange={set("embalagem")}>
            <option value="">Embalagem: todas</option>
            {listas.embalagens.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3 justify-between">
          {temFiltro ? (
            <button onClick={() => setF(VAZIO)} className="flex items-center gap-1 text-sm text-muted">
              <X size={16} /> Limpar filtros
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={exportar}
            disabled={filtrados.length === 0}
            className="flex items-center gap-2 bg-brand text-white px-5 py-3 rounded-md text-sm font-semibold disabled:opacity-50"
          >
            <Download size={18} /> Baixar Excel ({filtrados.length.toLocaleString("pt-BR")})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(([k, v]) => (
          <div key={k} className="bg-surface border border-line rounded-lg p-4">
            <p className="text-xs text-muted">{k}</p>
            <p className="text-2xl font-semibold text-ink tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <EmptyState title="Nenhum lançamento" description="Ajuste os filtros para ver os lançamentos." />
      ) : (
        <>
          {/* Celular: lista. Computador: tabela. */}
          <div className="lg:hidden">
            <ListaRolavel
              itens={filtrados}
              chave={(l) => l.id}
              reiniciarQuando={f}
              render={(l) => <LancamentoItem l={l} equivalente={nomeEq(l.produto_ref_id)} autor={autorDe(l, perfisPorId)} onClick={() => setAberto(l)} />}
            />
          </div>
          {/* Tabela com rolagem própria: 50 linhas por vez, mais ao rolar. */}
          <div onScroll={aoRolar} className="hidden lg:block bg-surface border border-line rounded-lg overflow-auto max-h-[70vh]">
            <table className="w-full text-sm">
              <thead className="bg-sunken text-muted text-xs text-left sticky top-0 z-10">
                <tr>
                  {["Data", "Vendedor", "Empresa", "Cidade/UF", "Marca", "Produto", "Visc.", "Embalagem", "Fluxo", "Preço", "Equivalente"].map((h) => (
                    <th key={h} className={`px-3 py-2.5 font-medium whitespace-nowrap ${h === "Preço" ? "text-right" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtrados.slice(0, limite).map((l) => (
                  <tr key={l.id} onClick={() => setAberto(l)} className="hover:bg-sunken cursor-pointer">
                    <td className="px-3 py-2 whitespace-nowrap text-muted">{formatData(l.created_at)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{autorDe(l, perfisPorId)}</td>
                    <td className="px-3 py-2 max-w-[180px] truncate">{l.empresa}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{[l.cidade, l.estado].filter(Boolean).join("/")}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{l.marca}</td>
                    <td className="px-3 py-2 max-w-[200px] truncate">{l.produto}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{l.viscosidade}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{l.sku || l.unidade}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted">{l.cliente?.replace("->", "→")}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right font-semibold tabular-nums">{formatBRL(l.preco)}</td>
                    <td className="px-3 py-2 max-w-[240px] truncate">
                      {nomeEq(l.produto_ref_id) ?? <span className="text-amber-700">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtrados.length > 50 && (
            <p className="hidden lg:block text-[11px] text-muted text-right">
              {Math.min(limite, filtrados.length).toLocaleString("pt-BR")} de {filtrados.length.toLocaleString("pt-BR")} · role a tabela para ver mais
            </p>
          )}
        </>
      )}

      {aberto && (
        <LancamentoDetalhe
          lancamento={aberto}
          perfil={perfil}
          produtos={produtos}
          cadastros={cadastros}
          autor={autorDe(aberto, perfisPorId)}
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
