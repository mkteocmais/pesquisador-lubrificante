import React, { useEffect, useState } from "react";

const LOTE = 50;

// Mostra os primeiros 50 itens numa caixa com rolagem própria (a página não
// fica infinita); chegando perto do fim da caixa, carrega mais 50.
export function usarLote(total: number, reiniciarQuando: unknown) {
  const [limite, setLimite] = useState(LOTE);
  useEffect(() => setLimite(LOTE), [reiniciarQuando]);
  const aoRolar = (e: React.UIEvent<HTMLElement>) => {
    const el = e.currentTarget;
    if (limite < total && el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
      setLimite((l) => Math.min(total, l + LOTE));
    }
  };
  return { limite, aoRolar };
}

interface Props<T> {
  itens: T[];
  chave: (item: T) => string;
  render: (item: T) => React.ReactNode;
  // Muda quando o filtro muda, para voltar aos primeiros 50.
  reiniciarQuando?: unknown;
  className?: string;
}

export function ListaRolavel<T>({ itens, chave, render, reiniciarQuando, className = "" }: Props<T>) {
  const { limite, aoRolar } = usarLote(itens.length, reiniciarQuando);
  return (
    <div className="space-y-1.5">
      <ul
        onScroll={aoRolar}
        className={`bg-surface border border-line rounded-lg divide-y divide-line overflow-y-auto overscroll-contain max-h-[65vh] ${className}`}
      >
        {itens.slice(0, limite).map((i) => (
          <React.Fragment key={chave(i)}>{render(i)}</React.Fragment>
        ))}
      </ul>
      {itens.length > LOTE && (
        <p className="text-[11px] text-muted text-right">
          {Math.min(limite, itens.length).toLocaleString("pt-BR")} de {itens.length.toLocaleString("pt-BR")} · role a lista para ver mais
        </p>
      )}
    </div>
  );
}
