import React, { useEffect, useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { theme } from "../../utils/theme";
import { Divisor, Logo, Sobretitulo } from "../common/Marca";

// Depois de 5 tentativas erradas seguidas, espera 30s antes de tentar de novo
// (o Supabase também limita no servidor; isso só evita insistência na tela).
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30_000;

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Seu acesso ainda não foi confirmado. Fale com o administrador.";
  if (m.includes("rate") || m.includes("too many")) return "Muitas tentativas. Espere um pouco e tente de novo.";
  if (m.includes("fetch") || m.includes("network")) return "Sem conexão com a internet. Confira o sinal e tente de novo.";
  return "Não foi possível entrar agora. Tente de novo em instantes.";
}

// Só login: as contas são criadas pelo administrador no Supabase, então não há
// tela de cadastro. A sessão fica salva no aparelho (o vendedor continua logado).
export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [failures, setFailures] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  const secondsLeft = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  const locked = secondsLeft > 0;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) return;
    setSubmitting(true);
    setAuthError(null);
    setAviso(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      const next = failures + 1;
      setFailures(next);
      setAuthError(friendlyAuthError(error.message));
      if (next >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + COOLDOWN_MS);
        setNow(Date.now());
        setFailures(0);
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-page text-ink flex flex-col md:flex-row font-sans">
      {/* Painel da marca no degradê azul do site da Evora (no celular ocupa o
          topo; no computador vira a coluna da esquerda). */}
      <div className="relative flex-1 md:flex-[1.1] min-h-[40vh] md:min-h-screen overflow-hidden bg-gradient-to-b from-brand-dark to-[#0A3CA6]">
        <div className="relative h-full flex flex-col justify-between p-6 md:p-12 pt-[max(env(safe-area-inset-top),1.5rem)] text-white">
          <Logo branco className="h-24 md:h-36 w-auto self-start" />
          <div className="py-8 md:py-0 max-w-md space-y-3">
            <Sobretitulo className="text-white/70">Pesquisa de preços</Sobretitulo>
            <h1 className="font-titulo text-[28px] md:text-[40px] font-extrabold uppercase leading-[1.15]">
              Performance a serviço de todos!
            </h1>
            <Divisor />
            <p className="pt-2 text-sm md:text-base text-white/80 max-w-sm">
              Lance os preços que você pesquisa e veja na hora como eles se comparam com o mercado.
            </p>
          </div>
          <p className="hidden md:block text-xs text-white/60">Marketing · Inteligência de Mercado</p>
        </div>
      </div>

      <div className="relative md:flex-1 md:flex md:items-center md:justify-center">
        <div className="relative -mt-8 md:mt-0 bg-surface rounded-t-xl md:rounded-lg md:border md:border-line px-6 pt-7 pb-[max(env(safe-area-inset-bottom),1.5rem)] md:p-10 w-full md:max-w-md animate-in slide-in-from-bottom-4 duration-500">
          <h2 className="font-titulo text-xl font-extrabold uppercase">Entrar</h2>
          <p className="text-sm text-muted mt-1">Use o e-mail e a senha que você recebeu.</p>

          <form onSubmit={handleLogin} className="space-y-4 mt-6" noValidate>
            {authError && (
              <div role="alert" className="bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-lg flex items-start gap-2.5 text-rose-600">
                <AlertCircle size={18} className="shrink-0 mt-px" />
                <p className="text-sm font-medium">{authError}</p>
              </div>
            )}
            {aviso && <p className="bg-brand-soft text-brand-ink p-3.5 rounded-lg text-sm">{aviso}</p>}
            <div className="space-y-1.5">
              <label htmlFor="auth-email" className="text-xs font-semibold text-slate-600 ml-1">
                E-mail
              </label>
              <input
                id="auth-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="voce@empresa.com.br"
                className={theme.input}
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                required
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="auth-password" className="text-xs font-semibold text-slate-600 ml-1">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => setAviso("Para trocar a senha, fale com o administrador do app.")}
                  className="text-xs font-semibold text-brand-ink"
                >
                  Esqueci a senha
                </button>
              </div>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  className={theme.input + " pr-12"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={submitting || locked || !email || !password} className={theme.botaoPrimario + " mt-2"}>
              {submitting ? <Loader2 className="animate-spin mx-auto" size={20} /> : locked ? `Tente de novo em ${secondsLeft}s` : "Entrar"}
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-muted">Acesso exclusivo para a equipe comercial</p>
        </div>
      </div>
    </div>
  );
}
