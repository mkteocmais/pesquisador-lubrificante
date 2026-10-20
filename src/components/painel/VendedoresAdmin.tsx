import React, { useMemo, useState } from "react";
import { Info, Loader2, Pencil } from "lucide-react";
import type { Lancamento, Perfil } from "../../types";
import { adminAtualizarPerfil, atualizarVarios } from "../../lib/api";
import { chaveTexto, formatData } from "../../utils/format";
import { mensagemErro } from "../../utils/erros";
import { UFS } from "../../utils/options";
import { theme } from "../../utils/theme";
import { Campo } from "../common/Campo";
import { Modal } from "../common/Modal";
import { useToast } from "../common/ToastProvider";
import type { DadosPainel } from "./PainelPage";

interface Props {
  dados: DadosPainel;
  perfil: Perfil;
  onAlterados: (l: Lancamento[]) => void;
  onPerfisAlterados: () => void;
}

export function VendedoresAdmin({ dados, perfil, onAlterados, onPerfisAlterados }: Props) {
  const { showError, showSuccess } = useToast();
  const [editando, setEditando] = useState<Perfil | null>(null);
  const [atribuindo, setAtribuindo] = useState<string | null>(null);
  const { perfis, lancamentos } = dados;

  const porVendedor = useMemo(() => {
    const m = new Map<string, { n: number; ultimo: string }>();
    for (const l of lancamentos) {
      if (!l.user_id) continue;
      const r = m.get(l.user_id) ?? { n: 0, ultimo: l.created_at };
      r.n += 1;
      if (l.created_at > r.ultimo) r.ultimo = l.created_at;
      m.set(l.user_id, r);
    }
    return m;
  }, [lancamentos]);

  // Lançamentos do app antigo (sem login), agrupados pelo nome digitado.
  const legado = useMemo(() => {
    const m = new Map<string, { nome: string; ids: string[] }>();
    for (const l of lancamentos) {
      if (l.user_id) continue;
      const k = chaveTexto(l.colaborador) || "(sem nome)";
      const r = m.get(k) ?? { nome: l.colaborador?.trim() || "(sem nome)", ids: [] };
      r.ids.push(l.id);
      m.set(k, r);
    }
    return Array.from(m.values()).sort((a, b) => b.ids.length - a.ids.length);
  }, [lancamentos]);

  const atribuir = async (grupo: { nome: string; ids: string[] }, userId: string) => {
    const dono = perfis.find((p) => p.id === userId);
    if (!dono) return;
    setAtribuindo(grupo.nome);
    try {
      await atualizarVarios(grupo.ids, { user_id: userId });
      const ids = new Set(grupo.ids);
      onAlterados(lancamentos.filter((l) => ids.has(l.id)).map((l) => ({ ...l, user_id: userId })));
      showSuccess(`${grupo.ids.length} lançamentos agora aparecem para ${dono.nome || dono.email}.`);
    } catch (e) {
      showError(mensagemErro(e));
    } finally {
      setAtribuindo(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-brand-soft text-brand-ink rounded-lg p-4 flex gap-3 text-sm">
        <Info size={18} className="shrink-0 mt-0.5" />
        <p>
          Para criar um acesso: no Supabase, abra <b>Authentication → Users → Add user → Create new user</b>, informe e-mail e senha e marque{" "}
          <b>Auto Confirm User</b>. O vendedor aparece aqui no primeiro login e informa o próprio nome.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-[17px] font-semibold text-ink">Acessos ({perfis.length})</h2>
        <ul className="bg-surface border border-line rounded-lg divide-y divide-line overflow-hidden">
          {perfis.map((p) => {
            const r = porVendedor.get(p.id);
            return (
              <li key={p.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] text-ink truncate">
                    {p.nome || <span className="text-muted">(ainda sem nome)</span>}
                    {p.papel === "admin" && <span className="ml-2 text-[11px] font-semibold bg-brand text-white px-2 py-0.5 rounded-full">admin</span>}
                    {!p.ativo && <span className="ml-2 text-[11px] font-semibold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">bloqueado</span>}
                  </p>
                  <p className="text-xs text-muted truncate">
                    {p.email}
                    {p.estado && ` · ${p.estado}`} · {r ? `${r.n} lançamentos, último em ${formatData(r.ultimo)}` : "nenhum lançamento"}
                  </p>
                </div>
                <button onClick={() => setEditando(p)} aria-label={`Editar ${p.nome || p.email}`} className="p-2.5 rounded-md text-brand-ink hover:bg-brand-soft">
                  <Pencil size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {legado.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-[17px] font-semibold text-ink">Lançamentos do app antigo</h2>
            <p className="text-sm text-muted">
              Feitos antes do login, só com o nome digitado. Atribua ao vendedor para eles aparecerem em "Meus preços" dele.
            </p>
          </div>
          <ul className="bg-surface border border-line rounded-lg divide-y divide-line overflow-hidden">
            {legado.map((g) => (
              <li key={g.nome} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <p className="flex-1 text-[15px] text-ink">
                  {g.nome} <span className="text-muted text-sm">· {g.ids.length}</span>
                </p>
                {atribuindo === g.nome ? (
                  <Loader2 size={18} className="animate-spin text-muted" />
                ) : (
                  <select
                    aria-label={`Atribuir lançamentos de ${g.nome}`}
                    className={theme.select + " py-2 text-sm sm:max-w-[260px]"}
                    value=""
                    onChange={(e) => e.target.value && atribuir(g, e.target.value)}
                  >
                    <option value="">Atribuir a...</option>
                    {perfis.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome || p.email}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {editando && (
        <EditarPerfil
          alvo={editando}
          proprio={editando.id === perfil.id}
          onFechar={() => setEditando(null)}
          onSalvo={() => {
            setEditando(null);
            onPerfisAlterados();
          }}
        />
      )}
    </div>
  );
}

function EditarPerfil({ alvo, proprio, onFechar, onSalvo }: { alvo: Perfil; proprio: boolean; onFechar: () => void; onSalvo: () => void }) {
  const { showError, showSuccess } = useToast();
  const [nome, setNome] = useState(alvo.nome ?? "");
  const [estado, setEstado] = useState(alvo.estado ?? "");
  const [papel, setPapel] = useState(alvo.papel);
  const [ativo, setAtivo] = useState(alvo.ativo);
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    setSalvando(true);
    try {
      await adminAtualizarPerfil({ id: alvo.id, nome: nome.trim() || null, estado: estado || null, papel, ativo });
      showSuccess("Acesso atualizado.");
      onSalvo();
    } catch (e) {
      showError(mensagemErro(e));
      setSalvando(false);
    }
  };

  return (
    <Modal title={alvo.email} onClose={onFechar}>
      <div className="space-y-4">
        <Campo label="Nome" htmlFor="p-nome">
          <input id="p-nome" autoComplete="off" className={theme.input} placeholder="Nome e sobrenome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
        </Campo>
        <Campo label="UF de atuação" htmlFor="p-uf" dica="Já vem preenchida no formulário quando o GPS não encontra.">
          <select id="p-uf" className={theme.select} value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">--</option>
            {UFS.map((u) => (
              <option key={u.sigla} value={u.sigla}>
                {u.sigla} · {u.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Papel" htmlFor="p-papel">
          <select id="p-papel" className={theme.select} value={papel} disabled={proprio} onChange={(e) => setPapel(e.target.value as Perfil["papel"])}>
            <option value="vendedor">Vendedor</option>
            <option value="admin">Administrador (vê tudo e baixa a planilha)</option>
          </select>
        </Campo>
        <label className="flex items-center gap-2 text-sm text-ink ml-1">
          <input type="checkbox" checked={ativo} disabled={proprio} onChange={(e) => setAtivo(e.target.checked)} />
          Acesso liberado (desmarque para bloquear o vendedor)
        </label>
        <button onClick={salvar} disabled={salvando} className={theme.botaoPrimario}>
          {salvando ? <Loader2 size={20} className="animate-spin mx-auto" /> : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}
