import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { salvarMeuNome } from "../../lib/api";
import { mensagemErro } from "../../utils/erros";
import { theme, textStyles } from "../../utils/theme";
import { useToast } from "../common/ToastProvider";

interface Props {
  email: string;
  onPronto: () => void;
  onSair: () => void;
}

// O login é criado só com e-mail; no primeiro acesso o vendedor diz o nome
// que vai aparecer nos lançamentos e na planilha do administrador.
export function PrimeiroAcesso({ email, onPronto, onSair }: Props) {
  const { showError } = useToast();
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nome.trim().length < 2) return;
    setSalvando(true);
    try {
      await salvarMeuNome(nome.trim());
      onPronto();
    } catch (err) {
      showError(mensagemErro(err));
      setSalvando(false);
    }
  };

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-6">
      <form onSubmit={salvar} className="bg-surface border border-line rounded-2xl p-6 md:p-8 w-full max-w-md space-y-5">
        <div>
          <h1 className={textStyles.h1}>Boas-vindas!</h1>
          <p className="text-sm text-muted mt-1">Como você quer aparecer nos lançamentos?</p>
        </div>
        <input
          autoFocus
          autoComplete="off"
          className={theme.input}
          placeholder="Nome e sobrenome"
          aria-label="Seu nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={120}
        />
        <button type="submit" disabled={salvando || nome.trim().length < 2} className={theme.botaoPrimario}>
          {salvando ? <Loader2 className="animate-spin mx-auto" size={20} /> : "Continuar"}
        </button>
        <p className="text-xs text-muted text-center">
          Entrou como {email}.{" "}
          <button type="button" onClick={onSair} className="text-brand-ink font-semibold">
            Sair
          </button>
        </p>
      </form>
    </div>
  );
}
