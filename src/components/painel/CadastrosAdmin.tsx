import React, { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Check, GitMerge, Loader2, Pencil, Plus, Search, X } from "lucide-react";
import type { CadEmpresa, CadMarca, CadProduto, Cadastros, Lancamento } from "../../types";
import { adminSalvarEmpresa, adminSalvarMarca, adminSalvarProduto, adminStatusCadastro } from "../../lib/api";
import { chaveTexto } from "../../utils/format";
import { mensagemErro } from "../../utils/erros";
import { DESEMPENHOS, UFS } from "../../utils/options";
import { similaridade } from "../../utils/similaridade";
import { theme } from "../../utils/theme";
import { Campo } from "../common/Campo";
import { EmptyState } from "../common/EmptyState";
import { ListaRolavel } from "../common/ListaRolavel";
import { Modal } from "../common/Modal";
import { useToast } from "../common/ToastProvider";

type Tipo = "empresa" | "marca" | "produto";
type Filtro = "ativos" | "revisar" | "arquivados";

interface Props {
  cadastros: Cadastros;
  lancamentos: Lancamento[];
  // Recarrega cadastros e lançamentos (uma correção de nome muda os dois).
  onAlterado: () => void;
}

// Item genérico das três listas, para a mesma tela servir a todas.
interface Item {
  tipo: Tipo;
  id: string;
  nome: string;
  detalhe: string;
  ativo: boolean;
  revisado: boolean;
  usos: number;
  // Itens só são comparados com outros do mesmo grupo (produto: mesma marca).
  grupo: string;
  original: CadEmpresa | CadMarca | CadProduto;
}

// Acima disso dois nomes são apontados como possíveis duplicados.
const LIMITE_DUPLICADO = 0.6;
const CHAVE_IGNORADOS = "pesquisador-duplicados-ignorados";

function lerIgnorados(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHAVE_IGNORADOS) || "[]"));
  } catch {
    return new Set();
  }
}

// Cadastros de Empresas, Marcas e Produtos de concorrentes que alimentam o
// autocompletar. Corrigir um nome corrige também os lançamentos; salvar com um
// nome que já existe une os dois.
export function CadastrosAdmin({ cadastros, lancamentos, onAlterado }: Props) {
  const { showError, showSuccess } = useToast();
  const [tipo, setTipo] = useState<Tipo>("marca");
  const [filtro, setFiltro] = useState<Filtro>("ativos");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Item | "novo" | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [ignorados, setIgnorados] = useState<Set<string>>(lerIgnorados);

  const marcaPorId = useMemo(() => new Map(cadastros.marcas.map((m) => [m.id, m])), [cadastros.marcas]);

  // Quantos lançamentos usam cada nome (para saber o peso de cada item).
  const usos = useMemo(() => {
    const m = new Map<string, number>();
    const soma = (k: string) => m.set(k, (m.get(k) ?? 0) + 1);
    for (const l of lancamentos) {
      soma(`marca|${chaveTexto(l.marca)}`);
      soma(`produto|${chaveTexto(l.marca)}|${chaveTexto(l.produto)}`);
      soma(`empresa|${chaveTexto(l.empresa)}|${chaveTexto(l.cidade)}|${l.estado ?? ""}`);
    }
    return m;
  }, [lancamentos]);

  const itens: Item[] = useMemo(() => {
    if (tipo === "marca") {
      return cadastros.marcas.map((m) => ({
        tipo,
        id: m.id,
        nome: m.nome,
        detalhe: (() => {
          const n = cadastros.produtos.filter((p) => p.ativo && p.marca_id === m.id).length;
          return `${n} ${n === 1 ? "produto" : "produtos"}`;
        })(),
        ativo: m.ativo,
        revisado: m.revisado,
        usos: usos.get(`marca|${chaveTexto(m.nome)}`) ?? 0,
        grupo: "",
        original: m,
      }));
    }
    if (tipo === "produto") {
      return cadastros.produtos.map((p) => {
        const marca = marcaPorId.get(p.marca_id)?.nome ?? "?";
        return {
          tipo,
          id: p.id,
          nome: p.nome,
          detalhe: [marca, p.viscosidade, p.desempenho].filter(Boolean).join(" · "),
          ativo: p.ativo,
          revisado: p.revisado,
          usos: usos.get(`produto|${chaveTexto(marca)}|${chaveTexto(p.nome)}`) ?? 0,
          grupo: p.marca_id,
          original: p,
        };
      });
    }
    return cadastros.empresas.map((e) => ({
      tipo,
      id: e.id,
      nome: e.nome,
      detalhe: [e.cidade, e.uf].filter(Boolean).join("/") || "sem cidade",
      ativo: e.ativo,
      revisado: e.revisado,
      usos: usos.get(`empresa|${chaveTexto(e.nome)}|${chaveTexto(e.cidade)}|${e.uf ?? ""}`) ?? 0,
      grupo: e.uf ?? "",
      original: e,
    }));
  }, [tipo, cadastros, usos, marcaPorId]);

  const filtrados = useMemo(() => {
    const termos = chaveTexto(busca).split(" ").filter(Boolean);
    return itens
      .filter((i) => (filtro === "arquivados" ? !i.ativo : i.ativo && (filtro === "ativos" || !i.revisado)))
      .filter((i) => !termos.length || termos.every((t) => chaveTexto(`${i.nome} ${i.detalhe}`).includes(t)))
      .sort((a, b) => b.usos - a.usos || a.nome.localeCompare(b.nome));
  }, [itens, filtro, busca]);

  // Auditoria de similaridade: pares de nomes muito parecidos no mesmo grupo.
  const duplicados = useMemo(() => {
    const ativos = itens.filter((i) => i.ativo);
    const pares: { a: Item; b: Item; nota: number }[] = [];
    for (let x = 0; x < ativos.length; x++) {
      for (let y = x + 1; y < ativos.length; y++) {
        const a = ativos[x];
        const b = ativos[y];
        if (a.grupo !== b.grupo) continue;
        const chavePar = [a.id, b.id].sort().join("|");
        if (ignorados.has(chavePar)) continue;
        const nota = similaridade(a.nome, b.nome);
        // O mais usado fica como destino sugerido.
        if (nota >= LIMITE_DUPLICADO) pares.push(a.usos >= b.usos ? { a: b, b: a, nota } : { a, b, nota });
      }
    }
    return pares.sort((p, q) => q.nota - p.nota).slice(0, 30);
  }, [itens, ignorados]);

  const ignorar = (a: Item, b: Item) => {
    const novo = new Set(ignorados);
    novo.add([a.id, b.id].sort().join("|"));
    setIgnorados(novo);
    try {
      localStorage.setItem(CHAVE_IGNORADOS, JSON.stringify(Array.from(novo)));
    } catch {
      // Sem armazenamento local: só vale nesta tela.
    }
  };

  const executar = async (id: string, acao: () => Promise<unknown>, ok: string) => {
    setOcupado(id);
    try {
      await acao();
      showSuccess(ok);
      onAlterado();
    } catch (e) {
      showError(mensagemErro(e));
    } finally {
      setOcupado(null);
    }
  };

  // Une "de" em "para": salva "de" com o nome (e dados) de "para".
  const unir = (de: Item, para: Item) =>
    executar(
      de.id,
      () => {
        if (de.tipo === "marca") return adminSalvarMarca(de.id, para.nome);
        if (de.tipo === "produto") {
          const p = para.original as CadProduto;
          return adminSalvarProduto({ id: de.id, marca_id: p.marca_id, nome: p.nome, viscosidade: p.viscosidade, desempenho: p.desempenho });
        }
        const e = para.original as CadEmpresa;
        return adminSalvarEmpresa({ id: de.id, nome: e.nome, cidade: e.cidade, uf: e.uf });
      },
      `"${de.nome}" unido a "${para.nome}". Os lançamentos foram corrigidos.`
    );

  const rotuloTipo = { empresa: "Empresas", marca: "Marcas", produto: "Produtos" };

  return (
    <div className="space-y-4">
      <div className="bg-brand-soft text-brand-ink rounded-lg p-4 text-sm">
        Estes nomes aparecem no autocompletar dos vendedores. Corrigir um nome corrige também os lançamentos já feitos;
        salvar com um nome que já existe <b>une</b> os dois. Nomes novos digitados pelos vendedores entram como "a revisar".
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex gap-1 bg-sunken p-1 rounded-md">
          {(["marca", "produto", "empresa"] as Tipo[]).map((t) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={`px-4 py-2 rounded text-sm font-medium ${tipo === t ? "bg-surface text-ink border border-line" : "text-muted"}`}
            >
              {rotuloTipo[t]}
            </button>
          ))}
        </div>
        <button onClick={() => setEditando("novo")} className="flex items-center gap-2 bg-brand text-white px-4 py-2.5 rounded-md text-sm font-semibold">
          <Plus size={16} /> Novo
        </button>
      </div>

      {duplicados.length > 0 && (
        <section className="bg-surface border border-amber-200 rounded-lg overflow-hidden">
          <p className="px-4 py-3 text-sm font-semibold text-amber-800 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
            <GitMerge size={16} /> Possíveis duplicados ({duplicados.length})
          </p>
          <ul className="divide-y divide-line max-h-[40vh] overflow-y-auto">
            {duplicados.map(({ a, b, nota }) => (
              <li key={`${a.id}|${b.id}`} className="px-4 py-2.5 flex flex-col md:flex-row md:items-center gap-2">
                <p className="flex-1 text-sm text-ink">
                  <b>{a.nome}</b> <span className="text-muted">({a.usos})</span> ≈ <b>{b.nome}</b>{" "}
                  <span className="text-muted">({b.usos})</span>
                  <span className="block text-xs text-muted">
                    {a.detalhe} · {Math.round(nota * 100)}% parecidos
                  </span>
                </p>
                {ocupado === a.id || ocupado === b.id ? (
                  <Loader2 size={18} className="animate-spin text-muted" />
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => unir(a, b)} className="text-xs font-semibold bg-brand text-white px-3 py-1.5 rounded">
                      Usar "{b.nome}"
                    </button>
                    <button onClick={() => unir(b, a)} className="text-xs font-semibold bg-brand-soft text-brand-ink px-3 py-1.5 rounded">
                      Usar "{a.nome}"
                    </button>
                    <button onClick={() => ignorar(a, b)} className="text-xs text-muted px-2 py-1.5">
                      São diferentes
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            autoComplete="off"
            className={theme.input + " pl-11 py-2.5 text-sm"}
            placeholder={`Buscar em ${rotuloTipo[tipo].toLowerCase()}...`}
            aria-label="Buscar no cadastro"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="flex gap-1 bg-sunken p-1 rounded-md self-start">
          {(
            [
              ["ativos", "Ativos"],
              ["revisar", `A revisar (${itens.filter((i) => i.ativo && !i.revisado).length})`],
              ["arquivados", "Arquivados"],
            ] as [Filtro, string][]
          ).map(([v, r]) => (
            <button
              key={v}
              onClick={() => setFiltro(v)}
              className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap ${filtro === v ? "bg-surface text-ink border border-line" : "text-muted"}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <EmptyState title="Nada aqui" description="Troque o filtro ou a busca." />
      ) : (
        <ListaRolavel
          itens={filtrados}
          chave={(i) => i.id}
          reiniciarQuando={`${tipo}|${filtro}|${busca}`}
          render={(i) => (
            <li className="px-4 py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[15px] text-ink truncate">
                  {i.nome}
                  {!i.revisado && i.ativo && (
                    <span className="ml-2 text-[11px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">a revisar</span>
                  )}
                </p>
                <p className="text-xs text-muted truncate">
                  {i.detalhe} · {i.usos} {i.usos === 1 ? "lançamento" : "lançamentos"}
                </p>
              </div>
              {ocupado === i.id ? (
                <Loader2 size={18} className="animate-spin text-muted" />
              ) : (
                <div className="flex items-center gap-0.5 shrink-0">
                  {i.ativo && !i.revisado && (
                    <BotaoIcone
                      titulo="Marcar como revisado"
                      onClick={() => executar(i.id, () => adminStatusCadastro(i.tipo, i.id, { revisado: true }), "Marcado como revisado.")}
                    >
                      <Check size={17} />
                    </BotaoIcone>
                  )}
                  {i.ativo && (
                    <BotaoIcone titulo="Corrigir" onClick={() => setEditando(i)}>
                      <Pencil size={17} />
                    </BotaoIcone>
                  )}
                  <BotaoIcone
                    titulo={i.ativo ? "Arquivar (sai do autocompletar)" : "Reativar"}
                    onClick={() =>
                      executar(i.id, () => adminStatusCadastro(i.tipo, i.id, { ativo: !i.ativo }), i.ativo ? "Arquivado." : "Reativado.")
                    }
                  >
                    {i.ativo ? <Archive size={17} /> : <ArchiveRestore size={17} />}
                  </BotaoIcone>
                </div>
              )}
            </li>
          )}
        />
      )}

      {editando && (
        <EditarCadastro
          tipo={tipo}
          item={editando === "novo" ? null : editando}
          cadastros={cadastros}
          onFechar={() => setEditando(null)}
          onSalvo={(msg) => {
            setEditando(null);
            showSuccess(msg);
            onAlterado();
          }}
        />
      )}
    </div>
  );
}

function BotaoIcone({ titulo, onClick, children }: { titulo: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={titulo} aria-label={titulo} className="p-2 rounded-md text-brand-ink hover:bg-brand-soft">
      {children}
    </button>
  );
}

interface EditarProps {
  tipo: Tipo;
  item: Item | null;
  cadastros: Cadastros;
  onFechar: () => void;
  onSalvo: (mensagem: string) => void;
}

function EditarCadastro({ tipo, item, cadastros, onFechar, onSalvo }: EditarProps) {
  const { showError } = useToast();
  const prod = item?.tipo === "produto" ? (item.original as CadProduto) : null;
  const emp = item?.tipo === "empresa" ? (item.original as CadEmpresa) : null;
  const [nome, setNome] = useState(item?.nome ?? "");
  const [marcaId, setMarcaId] = useState(prod?.marca_id ?? "");
  const [viscosidade, setViscosidade] = useState(prod?.viscosidade ?? "");
  const [desempenho, setDesempenho] = useState(prod?.desempenho ?? "");
  const [cidade, setCidade] = useState(emp?.cidade ?? "");
  const [uf, setUf] = useState(emp?.uf ?? "");
  const [salvando, setSalvando] = useState(false);

  // Avisa antes de salvar se o nome novo vai unir com outro item.
  const existente = useMemo(() => {
    const k = chaveTexto(nome);
    if (!k) return null;
    if (tipo === "marca") return cadastros.marcas.find((m) => m.ativo && m.id !== item?.id && chaveTexto(m.nome) === k)?.nome ?? null;
    if (tipo === "produto")
      return cadastros.produtos.find((p) => p.ativo && p.id !== item?.id && p.marca_id === marcaId && chaveTexto(p.nome) === k)?.nome ?? null;
    return (
      cadastros.empresas.find(
        (e) => e.ativo && e.id !== item?.id && chaveTexto(e.nome) === k && chaveTexto(e.cidade) === chaveTexto(cidade) && (e.uf ?? "") === uf
      )?.nome ?? null
    );
  }, [tipo, nome, marcaId, cidade, uf, cadastros, item]);

  const salvar = async () => {
    if (!chaveTexto(nome) || (tipo === "produto" && !marcaId)) return;
    setSalvando(true);
    try {
      if (tipo === "marca") await adminSalvarMarca(item?.id ?? null, nome);
      else if (tipo === "produto")
        await adminSalvarProduto({ id: item?.id ?? null, marca_id: marcaId, nome, viscosidade: viscosidade || null, desempenho: desempenho || null });
      else await adminSalvarEmpresa({ id: item?.id ?? null, nome, cidade: cidade || null, uf: uf || null });
      onSalvo(existente ? `Unido a "${existente}".` : item ? "Corrigido. Os lançamentos já usam o nome novo." : "Cadastrado.");
    } catch (e) {
      showError(mensagemErro(e));
      setSalvando(false);
    }
  };

  const titulo = `${item ? "Corrigir" : "Novo"} ${tipo === "marca" ? "marca" : tipo === "produto" ? "produto" : "empresa"}`;

  return (
    <Modal title={titulo} onClose={onFechar} onSubmit={salvar}>
      <div className="space-y-4">
        {tipo === "produto" && (
          <Campo label="Marca" htmlFor="c-marca">
            <select id="c-marca" className={theme.select} value={marcaId} onChange={(e) => setMarcaId(e.target.value)}>
              <option value="">Selecione...</option>
              {cadastros.marcas
                .filter((m) => m.ativo)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
            </select>
          </Campo>
        )}
        <Campo label="Nome" htmlFor="c-nome">
          <input id="c-nome" autoComplete="off" className={theme.input} placeholder="Nome correto" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={200} />
        </Campo>
        {tipo === "produto" && (
          <>
            <Campo label="Viscosidade" htmlFor="c-visc">
              <input id="c-visc" autoComplete="off" className={theme.input} placeholder="Ex: 15W-40, ISO 68" value={viscosidade} onChange={(e) => setViscosidade(e.target.value)} />
            </Campo>
            <Campo label="Desempenho" htmlFor="c-desemp" dica={`Ex: ${DESEMPENHOS.slice(0, 4).join(", ")}`}>
              <input id="c-desemp" autoComplete="off" className={theme.input} placeholder="Ex: API CI-4, ACEA E7" value={desempenho} onChange={(e) => setDesempenho(e.target.value)} />
            </Campo>
          </>
        )}
        {tipo === "empresa" && (
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Campo label="Cidade" htmlFor="c-cidade">
              <input id="c-cidade" autoComplete="off" className={theme.input} placeholder="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </Campo>
            <Campo label="UF" htmlFor="c-uf">
              <select id="c-uf" className={theme.select} value={uf} onChange={(e) => setUf(e.target.value)}>
                <option value="">--</option>
                {UFS.map((u) => (
                  <option key={u.sigla} value={u.sigla}>
                    {u.sigla}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
        )}
        {existente && item && (
          <p className="text-sm bg-amber-50 text-amber-800 border border-amber-200 rounded-md p-3">
            Já existe "{existente}". Ao salvar, os dois serão <b>unidos</b> e os lançamentos passam a usar "{existente}".
          </p>
        )}
        {item && !existente && <p className="text-xs text-muted">Os lançamentos que usam "{item.nome}" serão corrigidos junto.</p>}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onFechar} className="py-3.5 rounded-md border border-line text-sm font-semibold flex items-center justify-center gap-2">
            <X size={16} /> Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !chaveTexto(nome) || (tipo === "produto" && !marcaId)}
            className="py-3.5 rounded-md bg-brand text-white text-sm font-semibold disabled:opacity-50"
          >
            {salvando ? <Loader2 size={18} className="animate-spin mx-auto" /> : existente && item ? "Unir" : "Salvar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
