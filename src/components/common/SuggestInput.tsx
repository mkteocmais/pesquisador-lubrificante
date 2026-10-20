import React, { useMemo, useRef, useState } from "react";
import { chaveTexto as normalizeSearch } from "../../utils/format";

interface SuggestInputProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  // Sem nada digitado, mostra as opções mesmo assim (ex: categoria).
  showOnEmpty?: boolean;
}

// Campo com sugestões numa caixa própria: no máximo 5 visíveis e o resto
// rolando dentro dela. Substitui o <datalist>, que no Android abre uma lista
// gigante por cima da tela e do teclado.
export function SuggestInput({ value, onChange, options, placeholder, className = "", ariaLabel, showOnEmpty = false }: SuggestInputProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useRef(`sug-${Math.random().toString(36).slice(2, 8)}`).current;

  const filtered = useMemo(() => {
    const q = normalizeSearch(value);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const o of options) {
      const k = normalizeSearch(o || "");
      if (!k || seen.has(k)) continue;
      // Esconde a opção idêntica ao que já está escrito.
      if (q && (k === q || !k.includes(q))) continue;
      seen.add(k);
      out.push(o);
    }
    return q || showOnEmpty ? out.slice(0, 50) : [];
  }, [value, options, showOnEmpty]);

  const show = open && filtered.length > 0;
  const pick = (o: string) => {
    onChange(o);
    setOpen(false);
    setActive(-1);
  };

  return (
    <div className="relative">
      <input
        autoComplete="off"
        className={className}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(filtered.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(filtered[active]);
          } else if (e.key === "Escape") {
            e.stopPropagation();
            setOpen(false);
          }
        }}
      />
      {show && (
        <ul
          id={listId}
          role="listbox"
          // 5 linhas de 44px; o resto rola dentro da caixa.
          className="absolute top-full left-0 right-0 mt-1.5 z-[100] max-h-[220px] overflow-y-auto overscroll-contain bg-surface border border-line rounded-xl divide-y divide-line"
        >
          {filtered.map((o, i) => (
            <li key={o} role="option" aria-selected={i === active}>
              <button
                type="button"
                // mousedown pra escolher antes do blur fechar a lista.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
                className={`w-full h-11 px-4 text-left text-[15px] text-ink truncate ${
                  i === active ? "bg-sunken" : "hover:bg-sunken"
                }`}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
