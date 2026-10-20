import React from "react";
import { textStyles } from "../../utils/theme";

interface CampoProps {
  label: string;
  htmlFor?: string;
  dica?: string;
  children: React.ReactNode;
  className?: string;
}

// Rótulo + campo + dica opcional, com o mesmo espaçamento em todo formulário.
export function Campo({ label, htmlFor, dica, children, className = "" }: CampoProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={htmlFor} className={`${textStyles.label} ml-1 block`}>
        {label}
      </label>
      {children}
      {dica && <p className="text-xs text-muted ml-1">{dica}</p>}
    </div>
  );
}
