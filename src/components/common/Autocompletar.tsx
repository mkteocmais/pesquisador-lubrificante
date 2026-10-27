import React, { useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { chaveTexto } from "../../utils/format";
import { maisParecido, similaridade } from "../../utils/similaridade";

export interface ItemAuto<T = unknown> {
  rotulo: string;
  detalhe?: string;
  dados?: T;
  // Grupo menor aparece antes (ex: produtos da marca já escolhida = 0).
  grupo?: number;
}

interface Props<T> {
  value: string;
  onChange: (v: string) => void;
  itens: ItemAuto<T>[];
  // Chamado quando um item é escolhido. "automatico" = a pessoa digitou o
  // nome exato e saiu do campo, sem tocar na lista.
  onEscolher?: (item: ItemAuto<T>, automatico: boolean) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  id?: string;
  // Sem nada digitado, já mostra as opções (ex: embalagem).
  mostrarVazio?: boolean;
  // Vários valores separados por vírgula (ex: desempenho): sugere para o
  // trecho depois da última vírgula e não repete o que já foi escolhido.
  multiplo?: boolean;
  maxLength?: number;
}

// Na rua, no celular: poucas sugestões por vez. Quanto mais a pessoa digita,
// mais a lista afunila ("extravida" -> "extravida xv").
const MAX_LISTA = 5;
// A partir daqui um nome digitado é "parecido" com um do cadastro.
const LIMITE_PARECIDO = 0.5;

// Quão bem o item casa com o que foi digitado: 0 começa igual; 1 cada termo
// começa alguma palavra ("acea c" -> "ACEA C3", não "ACEA E7"); 2 só contém
// no meio da palavra; -1 não casa.
function nivel(rotulo: string, detalhe: string | undefined, k: string, termos: string[]): number {
  const alvo = chaveTexto(`${rotulo} ${detalhe ?? ""}`);
  if (!termos.every((t) => alvo.includes(t))) return -1;
  if (chaveTexto(rotulo).startsWith(k)) return 0;
  const palavras = alvo.split(/[\s/·()-]+/);
  if (termos.every((t) => palavras.some((p) => p.startsWith(t)))) return 1;
  return 2;
}

// Campo com sugestões dos cadastros. Mostra no máximo 5, os que começam com o
// texto primeiro; também acha nomes parecidos ("Kater" -> "Karter") e, se a
// pessoa digitar algo que não existe mas é muito parecido com um nome do
// cadastro, pergunta "Você quis dizer...?". Nunca obriga a escolher: um nome
// novo é aceito como digitado. Ao sair do campo, um nome igual ao do cadastro
// (só mudando maiúsculas ou acentos) é trocado pela grafia oficial.
export function Autocompletar<T>({
  value,
  onChange,
  itens,
  onEscolher,
  placeholder,
  ariaLabel,
  className = "",
  id,
  mostrarVazio = false,
  multiplo = false,
  maxLength,
}: Props<T>) {
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const listId = useRef(`auto-${Math.random().toString(36).slice(2, 8)}`).current;

  // No modo múltiplo, só o trecho depois da última vírgula conta.
  const partes = multiplo ? value.split(/[,;]/) : [value];
  const atual = partes[partes.length - 1];
  const anteriores = useMemo(
    () => (multiplo ? value.split(/[,;]/).slice(0, -1).map((s) => s.trim()).filter(Boolean) : []),
    [multiplo, value]
  );
  const k = chaveTexto(atual);

  const disponiveis = useMemo(() => {
    const usados = new Set(anteriores.map(chaveTexto));
    const lista = usados.size ? itens.filter((i) => !usados.has(chaveTexto(i.rotulo))) : itens;
    // Ordem estável por grupo: o grupo preferido vem antes.
    return lista.map((i, n) => ({ i, n })).sort((a, b) => (a.i.grupo ?? 0) - (b.i.grupo ?? 0) || a.n - b.n).map((x) => x.i);
  }, [itens, anteriores]);

  const exatos = useMemo(() => (k ? disponiveis.filter((i) => chaveTexto(i.rotulo) === k) : []), [disponiveis, k]);
  const exato = exatos[0];

  const filtrados = useMemo(() => {
    if (!k) return mostrarVazio ? disponiveis.slice(0, MAX_LISTA) : [];
    const termos = k.split(" ").filter(Boolean);
    const casados = disponiveis.map((i, n) => ({ i, n, nv: nivel(i.rotulo, i.detalhe, k, termos) })).filter((x) => x.nv >= 0);
    // Pelo meio da palavra só entra se nada começa com o que foi digitado.
    const temInicio = casados.some((x) => x.nv <= 1);
    const contem = casados
      .filter((x) => !temInicio || x.nv <= 1)
      .sort((a, b) => (a.i.grupo ?? 0) - (b.i.grupo ?? 0) || a.nv - b.nv || a.n - b.n)
      .map((x) => x.i)
      .slice(0, MAX_LISTA);
    // Nada contém o texto? Provável erro de digitação: mostra os parecidos.
    // Com algum resultado, a lista fica só com ele ("extravida xv" não traz
    // "extravida plus").
    if (contem.length === 0 && k.length >= 3) {
      const ja = new Set(contem);
      const parecidos = disponiveis
        .filter((i) => !ja.has(i))
        .map((i) => ({ i, nota: similaridade(atual, i.rotulo) }))
        .filter((x) => x.nota >= 0.4)
        .sort((a, b) => b.nota - a.nota)
        .slice(0, MAX_LISTA)
        .map((x) => x.i);
      return parecidos;
    }
    return contem;
  }, [disponiveis, k, atual, mostrarVazio]);

  const sugestao = useMemo(() => {
    if (!k || exato || k.length < 3) return null;
    return maisParecido(atual, disponiveis, (i) => i.rotulo, LIMITE_PARECIDO);
  }, [disponiveis, k, atual, exato]);

  const comTexto = (rotulo: string, fim = "") => (multiplo ? [...anteriores, rotulo].join(", ") + fim : rotulo);

  const escolher = (item: ItemAuto<T>, automatico = false) => {
    // No múltiplo, deixa a vírgula pronta para o próximo valor.
    onChange(comTexto(item.rotulo, multiplo && !automatico ? ", " : ""));
    onEscolher?.(item, automatico);
    setAberto(false);
    setAtivo(-1);
  };

  // Já digitou o nome exato e só ele aparece: esconde a lista, a não ser que
  // o item traga algo a mais (ex: a marca do produto, que vem junto ao tocar).
  const visiveis = filtrados.filter((i) => !(exato && i === exato && filtrados.length === 1 && !i.detalhe));
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
        maxLength={maxLength}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setAberto(true);
          setAtivo(-1);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => {
          setAberto(false);
          if (exato && exato.rotulo !== atual.trim()) {
            // Mesma palavra com outra grafia: usa a do cadastro. Se o mesmo
            // nome existe em mais de um lugar (produto igual em marcas
            // diferentes), só corrige a grafia, sem escolher por ela.
            if (exatos.length === 1) escolher(exato, true);
            else onChange(comTexto(exato.rotulo));
          } else if (multiplo && /[,;]\s*$/.test(value)) {
            onChange(value.replace(/[,;\s]+$/, ""));
          }
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
          className="absolute top-full left-0 right-0 mt-1 z-[100] bg-surface border border-line rounded-md divide-y divide-line shadow-lg"
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
          className="mt-1.5 flex items-center gap-1.5 text-xs text-brand-ink bg-brand-soft px-3 py-1.5 rounded-md text-left"
        >
          <Sparkles size={13} className="shrink-0" />
          <span>
            Você quis dizer <b>{sugestao.item.rotulo}</b>
            {sugestao.item.detalhe ? <span className="text-muted"> ({sugestao.item.detalhe})</span> : null}?
          </span>
        </button>
      )}
    </div>
  );
}
