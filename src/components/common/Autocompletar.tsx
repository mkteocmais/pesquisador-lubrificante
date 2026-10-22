import React, { useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { chaveTexto } from "../../utils/format";
import { maisParecido, similaridade } from "../../utils/similaridade";

export interface ItemAuto<T = unknown> {
  rotulo: string;
  detalhe?: string;
  dados?: T;
}

interface Props<T> {
  value: string;
  onChange: (v: string) => void;
  itens: ItemAuto<T>[];
  // Chamado quando a pessoa escolhe um item (da lista ou do "Você quis dizer").
  onEscolher?: (item: ItemAuto<T>) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  id?: string;
  // Sem nada digitado, já mostra as opções (ex: embalagem).
  mostrarVazio?: boolean;
}

const MAX_LISTA = 50;
// A partir daqui um nome digitado é "parecido" com um do cadastro.
const LIMITE_PARECIDO = 0.5;

// Campo com sugestões dos cadastros. Além do "contém", acha nomes parecidos
// ("Kater" -> "Karter") e, se a pessoa digitar algo que não existe mas é
// muito parecido com um nome do cadastro, pergunta "Você quis dizer...?".
// Ao sair do campo, um nome igual ao do cadastro (só mudando maiúsculas ou
// acentos) é trocado pela grafia oficial.
export function Autocompletar<T>({ value, onChange, itens, onEscolher, placeholder, ariaLabel, className = "", id, mostrarVazio = false }: Props<T>) {
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const listId = useRef(`auto-${Math.random().toString(36).slice(2, 8)}`).current;

  const k = chaveTexto(value);
  const exato = useMemo(() => (k ? itens.find((i) => chaveTexto(i.rotulo) === k) : undefined), [itens, k]);

  const filtrados = useMemo(() => {
    if (!k) return mostrarVazio ? itens.slice(0, MAX_LISTA) : [];
    const termos = k.split(" ").filter(Boolean);
    const contem = itens.filter((i) => {
      const alvo = chaveTexto(`${i.rotulo} ${i.detalhe ?? ""}`);
      return termos.every((t) => alvo.includes(t));
    });
    // Poucos resultados? Completa com os parecidos (erro de digitação).
    if (contem.length < 5 && k.length >= 3) {
      const ja = new Set(contem);
      const parecidos = itens
        .filter((i) => !ja.has(i))
        .map((i) => ({ i, nota: similaridade(value, i.rotulo) }))
        .filter((x) => x.nota >= 0.4)
        .sort((a, b) => b.nota - a.nota)
        .slice(0, 5)
        .map((x) => x.i);
      return [...contem, ...parecidos].slice(0, MAX_LISTA);
    }
    return contem.slice(0, MAX_LISTA);
  }, [itens, k, value, mostrarVazio]);

  const sugestao = useMemo(() => {
    if (!k || exato || k.length < 3) return null;
    return maisParecido(value, itens, (i) => i.rotulo, LIMITE_PARECIDO);
  }, [itens, k, value, exato]);

  const escolher = (item: ItemAuto<T>) => {
    onChange(item.rotulo);
    onEscolher?.(item);
    setAberto(false);
    setAtivo(-1);
  };

  const visiveis = filtrados.filter((i) => !(exato && i === exato && filtrados.length === 1));
  const mostrar = aberto && visiveis.length > 0;

  return (
    <div className="relative">
      <input
        id={id}
        autoComplete="off"
        className={className}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        role="combobox"
        aria-expanded={mostrar}
        aria-controls={listId}
        aria-autocomplete="list"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setAberto(true);
          setAtivo(-1);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => {
          setAberto(false);
          // Mesma palavra com outra grafia: usa a do cadastro.
          if (exato && exato.rotulo !== value) escolher(exato);
        }}
        onKeyDown={(e) => {
          if (!mostrar) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setAtivo((a) => Math.min(visiveis.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setAtivo((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter" && ativo >= 0) {
            e.preventDefault();
            escolher(visiveis[ativo]);
          } else if (e.key === "Escape") {
            e.stopPropagation();
            setAberto(false);
          }
        }}
      />
      {mostrar && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 z-[100] max-h-[264px] overflow-y-auto overscroll-contain bg-surface border border-line rounded-md divide-y divide-line shadow-lg"
        >
          {visiveis.map((i, n) => (
            <li key={`${i.rotulo}|${i.detalhe ?? ""}|${n}`} role="option" aria-selected={n === ativo}>
              <button
                type="button"
                // mousedown para escolher antes do blur fechar a lista.
                onMouseDown={(e) => {
                  e.preventDefault();
                  escolher(i);
                }}
                className={`w-full px-4 py-2.5 text-left ${n === ativo ? "bg-sunken" : "hover:bg-sunken"}`}
              >
                <span className="block text-[15px] text-ink truncate">{i.rotulo}</span>
                {i.detalhe && <span className="block text-xs text-muted truncate">{i.detalhe}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {sugestao && !aberto && (
        <button
          type="button"
          onClick={() => escolher(sugestao.item)}
          className="mt-1.5 flex items-center gap-1.5 text-xs text-brand-ink bg-brand-soft px-3 py-1.5 rounded-md"
        >
          <Sparkles size={13} />
          Você quis dizer <b>{sugestao.item.rotulo}</b>
          {sugestao.item.detalhe ? <span className="text-muted">({sugestao.item.detalhe})</span> : null}?
        </button>
      )}
    </div>
  );
}
