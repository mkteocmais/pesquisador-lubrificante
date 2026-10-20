// Visual da Evora: superfícies brancas com borda fina, cantos quase retos,
// títulos em caixa alta (Open Sans extra-negrito) e o azul Evora na ação
// principal. O vermelho fica para marcadores e destaques.
export const theme = {
  input:
    "w-full bg-surface px-4 py-3.5 rounded-md outline-none border border-[#CED4DA] focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors font-normal text-ink text-[15px] placeholder:text-slate-400 disabled:opacity-60",
  select:
    "w-full bg-surface px-4 py-3.5 rounded-md outline-none border border-[#CED4DA] focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors font-normal text-ink text-[15px]",
  botaoPrimario:
    "w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-white py-4 rounded-md font-medium text-[15px] tracking-wide active:scale-[0.99] transition-all",
  botaoSecundario:
    "w-full bg-surface border-2 border-brand text-brand-ink py-3.5 rounded-md font-medium text-[15px] tracking-wide active:scale-[0.99] transition-all",
};

export const ui = {
  card: "bg-surface border border-line rounded-lg",
  box: "border border-line rounded-md",
  divider: "divide-y divide-line",
  link: "text-brand-ink font-medium",
  muted: "text-muted",
};

export const textStyles = {
  h1: "font-titulo text-[22px] md:text-[26px] font-extrabold uppercase leading-tight text-ink",
  section: "font-titulo text-[14px] font-bold uppercase tracking-wide text-ink",
  label: "text-[13px] font-medium text-[#495057]",
  cardLabel: "text-[13px] font-normal text-muted",
  cardValue: "text-xl font-semibold text-ink",
  body: "text-[15px] font-normal text-ink",
  small: "text-xs font-normal",
};
