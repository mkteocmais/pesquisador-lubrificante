import React from "react";
import { textStyles } from "../../utils/theme";

// Elementos de marca da Evora usados nas telas.

export function Logo({ branco = false, className = "" }: { branco?: boolean; className?: string }) {
  return branco ? (
    <img src="/evora-logo-branco.png" alt="Evora Lubrificantes" className={className} />
  ) : (
    <img src="/evora-logo.svg" alt="Evora Lubrificantes" className={className} />
  );
}

// Sobretítulo espaçado ("E V O R A  L U B R I F I C A N T E S" no site).
export function Sobretitulo({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`font-condensado text-[11px] font-bold uppercase tracking-[0.35em] ${className}`}>{children}</p>;
}

// Divisor do site: círculo vermelho seguido de linha pontilhada.
export function Divisor({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`} aria-hidden="true">
      <span className="w-3.5 h-3.5 rounded-full border-2 border-accent flex items-center justify-center shrink-0">
        <span className="w-1 h-1 rounded-full bg-accent" />
      </span>
      <span className="w-36 border-t-2 border-dotted border-accent" />
    </div>
  );
}

// Título de página: sobretítulo + título em caixa alta + divisor.
export function TituloPagina({ sobre, titulo, children }: { sobre?: string; titulo: string; children?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      {sobre && <Sobretitulo className="text-muted">{sobre}</Sobretitulo>}
      <h1 className={textStyles.h1}>{titulo}</h1>
      <Divisor className="pt-1" />
      {children}
    </div>
  );
}
