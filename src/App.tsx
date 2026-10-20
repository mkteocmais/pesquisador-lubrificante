import React, { useCallback, useEffect, useState } from "react";
import { ClipboardList, LayoutDashboard, Loader2, LogOut, PlusCircle } from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { supabase } from "./lib/supabaseClient";
import { carregarConcorrentes, carregarPerfil, carregarProdutos, meusLancamentos } from "./lib/api";
import type { Aba, Concorrente, Lancamento, Perfil, Produto } from "./types";
import { mensagemErro } from "./utils/erros";
import { AuthScreen } from "./components/auth/AuthScreen";
import { PrimeiroAcesso } from "./components/auth/PrimeiroAcesso";
import { BottomTab } from "./components/common/BottomTab";
import { useToast } from "./components/common/ToastProvider";
import { LancarPage } from "./components/lancar/LancarPage";
import { MeusPrecosPage } from "./components/meus/MeusPrecosPage";
import { PainelPage } from "./components/painel/PainelPage";

function TelaCheia({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-page flex items-center justify-center p-6 text-center">{children}</div>;
}

export default function App() {
  const { user, authLoading } = useAuth();
  const { showError } = useToast();
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(undefined);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [concorrentes, setConcorrentes] = useState<Concorrente[]>([]);
  const [meus, setMeus] = useState<Lancamento[] | null>(null);
  const [aba, setAba] = useState<Aba>("lancar");

  const sair = () => supabase.auth.signOut();

  const carregarSessao = useCallback(async () => {
    if (!user) return;
    try {
      const p = await carregarPerfil(user.id);
      setPerfil(p);
      // O administrador no computador abre direto no painel.
      if (p?.papel === "admin" && window.innerWidth >= 1024) setAba("painel");
    } catch (e) {
      showError(mensagemErro(e));
      setPerfil(null);
    }
  }, [user, showError]);

  useEffect(() => {
    setPerfil(undefined);
    setMeus(null);
    if (user) carregarSessao();
  }, [user, carregarSessao]);

  const pronto = !!perfil && perfil.ativo && !!perfil.nome;

  useEffect(() => {
    if (!pronto || !user) return;
    carregarProdutos().then(setProdutos).catch((e) => showError(mensagemErro(e)));
    carregarConcorrentes().then(setConcorrentes).catch(() => setConcorrentes([]));
    meusLancamentos(user.id)
      .then(setMeus)
      .catch((e) => {
        showError(mensagemErro(e));
        setMeus([]);
      });
  }, [pronto, user, showError]);

  const trocarAba = (a: Aba) => {
    setAba(a);
    window.scrollTo({ top: 0 });
  };

  if (authLoading || (user && perfil === undefined)) {
    return (
      <TelaCheia>
        <Loader2 className="animate-spin text-brand" size={28} />
      </TelaCheia>
    );
  }
  if (!user) return <AuthScreen />;
  if (!perfil) {
    return (
      <TelaCheia>
        <div className="space-y-3 max-w-sm">
          <p className="text-ink font-semibold">Seu acesso ainda não foi liberado.</p>
          <p className="text-sm text-muted">Fale com o administrador do app.</p>
          <button onClick={sair} className="text-brand-ink font-semibold text-sm">
            Sair
          </button>
        </div>
      </TelaCheia>
    );
  }
  if (!perfil.ativo) {
    return (
      <TelaCheia>
        <div className="space-y-3 max-w-sm">
          <p className="text-ink font-semibold">Seu acesso está bloqueado.</p>
          <p className="text-sm text-muted">Fale com o administrador do app.</p>
          <button onClick={sair} className="text-brand-ink font-semibold text-sm">
            Sair
          </button>
        </div>
      </TelaCheia>
    );
  }
  if (!perfil.nome) return <PrimeiroAcesso email={perfil.email} onPronto={carregarSessao} onSair={sair} />;

  const admin = perfil.papel === "admin";
  const abas: { id: Aba; rotulo: string; icone: React.ReactNode }[] = [
    { id: "lancar", rotulo: "Lançar", icone: <PlusCircle size={22} /> },
    { id: "meus", rotulo: "Meus preços", icone: <ClipboardList size={22} /> },
    ...(admin ? [{ id: "painel" as Aba, rotulo: "Painel", icone: <LayoutDashboard size={22} /> }] : []),
  ];

  const aoSalvar = (l: Lancamento) => {
    setMeus((atual) => (atual ? [l, ...atual.filter((x) => x.id !== l.id)] : [l]));
    // Novo concorrente entra no autocompletar dos próximos lançamentos.
    carregarConcorrentes().then(setConcorrentes).catch(() => undefined);
  };

  return (
    <div className="min-h-screen bg-page">
      <header className="bg-brand text-white border-b-4 border-accent sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
        <div className={`mx-auto px-4 h-14 flex items-center gap-4 ${aba === "painel" ? "max-w-7xl" : "max-w-3xl"}`}>
          <span className="text-[13px] font-semibold tracking-wide whitespace-nowrap">
            PESQUISADOR <span className="hidden sm:inline">DE </span>
            <span className="text-accent">LUBRIFICANTE</span>
          </span>
          {/* Computador: abas no topo. Celular: barra inferior. */}
          <nav className="hidden md:flex gap-1 ml-4">
            {abas.map((a) => (
              <button
                key={a.id}
                onClick={() => trocarAba(a.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${aba === a.id ? "bg-white/15" : "text-white/70 hover:text-white"}`}
              >
                {a.rotulo}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 min-w-0">
            <span className="text-sm text-white/80 truncate hidden sm:block">{perfil.nome}</span>
            <button onClick={sair} aria-label="Sair" title="Sair" className="p-2 -mr-2 rounded-lg hover:bg-white/10">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className={`mx-auto px-4 pt-5 pb-28 md:pb-12 ${aba === "painel" ? "max-w-7xl" : "max-w-xl"}`}>
        {aba === "lancar" && (
          <LancarPage perfil={perfil} produtos={produtos} concorrentes={concorrentes} onSalvo={aoSalvar} onVerMeus={() => trocarAba("meus")} />
        )}
        {aba === "meus" && (
          <MeusPrecosPage
            perfil={perfil}
            produtos={produtos}
            concorrentes={concorrentes}
            lancamentos={meus}
            onAlterado={aoSalvar}
            onExcluido={(id) => setMeus((atual) => atual && atual.filter((l) => l.id !== id))}
            onLancar={() => trocarAba("lancar")}
          />
        )}
        {aba === "painel" && admin && <PainelPage perfil={perfil} produtos={produtos} concorrentes={concorrentes} />}
      </main>

      <nav className={`md:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-line pb-safe z-40 grid ${admin ? "grid-cols-3" : "grid-cols-2"}`}>
        {abas.map((a) => (
          <BottomTab key={a.id} active={aba === a.id} onClick={() => trocarAba(a.id)} icon={a.icone} label={a.rotulo} />
        ))}
      </nav>
    </div>
  );
}
