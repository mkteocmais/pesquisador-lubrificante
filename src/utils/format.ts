export const formatBRL = (value: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0).replace(/\s/g, " ");

// Data/hora do Supabase (timestamptz) no fuso do aparelho.
export function formatData(iso: string, comHora = false): string {
  const d = new Date(iso);
  const data = d.toLocaleDateString("pt-BR");
  if (!comHora) return data;
  return `${data} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

// "2026-10-20" no fuso do aparelho (para filtros de período).
export function dataLocalISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

// Mesma regra de public.chave_texto no banco: compara sem acento, sem
// maiúsculas e sem espaços sobrando ("KARTER " = "Karter").
export function chaveTexto(s: string | null | undefined): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Mesma regra de public.chave_visc: "SAE 15W-40" = "15w40".
export function chaveVisc(s: string | null | undefined): string {
  return (s || "").toLowerCase().replace(/^\s*sae/, "").replace(/[\s-]/g, "");
}

// Aceita "1.234,56", "330,5" e "330.50".
export function parsePreco(texto: string): number {
  const t = texto.replace(/\s|R\$/g, "");
  if (!t) return NaN;
  const normalizado = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  return Number(normalizado);
}

export function precoParaTexto(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "";
  return v.toFixed(2).replace(".", ",");
}

export function variacao(preco: number, referencia: number): number {
  return referencia > 0 ? (preco - referencia) / referencia : 0;
}

export function formatPct(v: number): string {
  return `${Math.abs(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;
}
