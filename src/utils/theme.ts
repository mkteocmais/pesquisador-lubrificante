// Mesmo visual do Juntto: superfícies planas com borda fina, a cor da marca só
// em links, itens ativos e na ação principal.
export const theme = {
  input:
    "w-full bg-surface px-4 py-3.5 rounded-xl outline-none border border-[#D5D8E2] focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors font-normal text-ink text-[15px] placeholder:text-slate-400 disabled:opacity-60",
  select:
    "w-full bg-surface px-4 py-3.5 rounded-xl outline-none border border-[#D5D8E2] focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors font-normal text-ink text-[15px]",
  botaoPrimario:
    "w-full bg-brand disabled:opacity-50 text-white py-4 rounded-2xl font-semibold text-[15px] active:scale-[0.98] transition-all",
  botaoSecundario:
    "w-full bg-brand-soft text-brand-ink py-3.5 rounded-2xl font-semibold text-[15px] active:scale-[0.98] transition-all",
};

export const ui = {
  card: "bg-surface border border-line rounded-2xl",
  box: "border border-line rounded-xl",
  divider: "divide-y divide-line",
  link: "text-brand-ink font-medium",
  muted: "text-muted",
};

export const textStyles = {
  h1: "text-[22px] font-semibold tracking-tight text-ink",
  section: "text-[17px] font-semibold text-ink",
  label: "text-[13px] font-medium text-slate-600",
  cardLabel: "text-[13px] font-normal text-muted",
  cardValue: "text-xl font-semibold text-ink",
  body: "text-[15px] font-normal text-ink",
  small: "text-xs font-normal",
};
