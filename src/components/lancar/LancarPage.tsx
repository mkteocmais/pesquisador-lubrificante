import React, { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { Cadastros, Lancamento, Perfil, Produto } from "../../types";
import { formatBRL } from "../../utils/format";
import { theme, textStyles } from "../../utils/theme";
import { TituloPagina } from "../common/Marca";
import { DevolutivaCard } from "./DevolutivaCard";
import { LancamentoForm, LocalPesquisa } from "./LancamentoForm";

interface Props {
  perfil: Perfil;
  produtos: Produto[];
  cadastros: Cadastros;
  onSalvo: (l: Lancamento) => void;
  onVerMeus: () => void;
}

export function LancarPage({ perfil, produtos, cadastros, onSalvo, onVerMeus }: Props) {
  const [salvo, setSalvo] = useState<Lancamento | null>(null);
  const [local, setLocal] = useState<LocalPesquisa | null>(null);
  // Muda a key para o formulário começar do zero.
  const [rodada, setRodada] = useState(0);

  const novo = (manterLocal: boolean) => {
    if (!manterLocal) setLocal(null);
    setSalvo(null);
    setRodada((r) => r + 1);
    window.scrollTo({ top: 0 });
  };

  if (salvo) {
    const equivalente = produtos.find((p) => p.id === salvo.produto_ref_id);
    return (
      <div className="space-y-5 animate-in fade-in duration-300">
        <div className="text-center pt-2">
          <CheckCircle2 size={44} className="mx-auto text-emerald-600" />
          <h1 className={`${textStyles.h1} mt-3`}>Preço gravado</h1>
          <p className="text-sm text-muted mt-1">
            {salvo.marca} {salvo.produto} · {salvo.sku} · {formatBRL(salvo.preco)}
          </p>
          {equivalente && <p className="text-xs text-muted mt-0.5">Equivalente: {equivalente.nome}</p>}
        </div>
        <DevolutivaCard lancamento={salvo} equivalente={equivalente} />
        <div className="space-y-3">
          <button className={theme.botaoPrimario} onClick={() => novo(true)}>
            Lançar outro em {salvo.empresa}
          </button>
          <button className={theme.botaoSecundario} onClick={() => novo(false)}>
            Novo local
          </button>
          <button className="w-full py-3 text-sm font-semibold text-brand-ink" onClick={onVerMeus}>
            Ver meus preços
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <TituloPagina sobre={`Olá, ${perfil.nome?.split(" ")[0] ?? ""}`} titulo="Lançar preço">
        <p className="text-sm text-muted pt-1">Preencha o que você pesquisou.</p>
      </TituloPagina>
      <LancamentoForm
        key={rodada}
        perfil={perfil}
        produtos={produtos}
        cadastros={cadastros}
        local={local}
        onSalvo={(l, loc) => {
          setSalvo(l);
          setLocal(loc);
          onSalvo(l);
          window.scrollTo({ top: 0 });
        }}
      />
    </div>
  );
}
