import { chaveTexto } from "./format";

// Listas do formulário. Os textos são os mesmos do app antigo para os
// lançamentos novos agruparem com o histórico.

export const VISCOSIDADES: { grupo: string; opcoes: string[] }[] = [
  {
    grupo: "Motor",
    opcoes: ["0W-16", "0W-20", "0W-30", "0W-40", "5W-20", "5W-30", "5W-40", "10W-30", "10W-40", "15W-40", "20W-50", "25W-50", "SAE 30", "SAE 40", "SAE 50"],
  },
  {
    grupo: "Transmissão / Engrenagem",
    opcoes: ["SAE 80W", "SAE 90", "SAE 140", "SAE 75W-80", "SAE 75W-90", "SAE 80W-90", "SAE 85W-140"],
  },
  {
    grupo: "Industrial (ISO)",
    opcoes: ["ISO 32", "ISO 46", "ISO 68", "ISO 100", "ISO 150", "ISO 220", "ISO 320", "ISO 460", "ISO 680", "ISO 1000"],
  },
  { grupo: "Graxa (NLGI)", opcoes: ["NLGI 00", "NLGI 0", "NLGI 1", "NLGI 2", "NLGI 3"] },
];

export const TODAS_VISCOSIDADES = VISCOSIDADES.flatMap((g) => g.opcoes);

// Cadeia de venda, na ordem: cada elo só vende para quem vem depois dele.
// O fluxo é gravado exatamente como aparece: "Vendedor -> Comprador"
// ("Distribuidor (DA) -> Consumidor"). O retorno de preço compara pelo texto
// exato: mudar um nome aqui exige migrar os lançamentos (ver migrações fluxos_*).
export const ELOS: { valor: string; rotulo: string }[] = [
  { valor: "Fábrica", rotulo: "Fábrica" },
  { valor: "Distribuidor (DA)", rotulo: "Distribuidor (DA)" },
  { valor: "Atacadista", rotulo: "Atacadista" },
  { valor: "Revendedor", rotulo: "Revendedor" },
  { valor: "Consumidor", rotulo: "Consumidor" },
];

// O consumidor é o fim da cadeia: compra, mas não vende.
export const VENDEDORES = ELOS.slice(0, -1);

export function compradoresDe(vendedor: string) {
  const i = ELOS.findIndex((e) => e.valor === vendedor);
  return i < 0 ? [] : ELOS.slice(i + 1);
}

export function montarFluxo(vendedor: string, comprador: string): string {
  return vendedor && comprador ? `${vendedor} -> ${comprador}` : "";
}

// "Distribuidor (DA) -> Consumidor" -> ["Distribuidor (DA)", "Consumidor"].
// Compara sem os complementos entre parênteses, para também reconhecer
// textos antigos ("Distribuidor -> Consumidor", "Atacadista (Grande Volume)").
const semParenteses = (t: string | undefined) => chaveTexto((t || "").replace(/\(.*?\)/g, ""));
export function separarFluxo(texto: string | null | undefined): [string, string] {
  const [v, c] = (texto || "").split("->");
  const achar = (nome: string | undefined) => ELOS.find((e) => semParenteses(e.valor) === semParenteses(nome))?.valor ?? "";
  return [achar(v), achar(c)];
}

// Texto compilado do fluxo, igual ao gravado, para a tela e a planilha:
// "Distribuidor (DA) -> Consumidor". Também normaliza textos antigos.
export function rotuloFluxo(texto: string | null | undefined): string {
  if (!texto) return "";
  const [v, c] = separarFluxo(texto);
  return v && c ? montarFluxo(v, c) : texto;
}

// Todas as combinações válidas (10), na ordem da cadeia.
export const FLUXOS = VENDEDORES.flatMap((v) => compradoresDe(v.valor).map((c) => montarFluxo(v.valor, c.valor)));

// Embalagem e o volume (L ou kg) de cada uma, para o preço por litro/quilo
// na planilha de análise.
export const EMBALAGENS: { nome: string; volume: number | null; unidade: "L" | "kg" | null }[] = [
  { nome: "Bisnaga 80g", volume: 0.08, unidade: "kg" },
  { nome: "Frasco 100ml", volume: 0.1, unidade: "L" },
  { nome: "Frasco 200ml", volume: 0.2, unidade: "L" },
  { nome: "Pote 500g", volume: 0.5, unidade: "kg" },
  { nome: "Frasco 900ml", volume: 0.9, unidade: "L" },
  { nome: "Pote 1Kg", volume: 1, unidade: "kg" },
  { nome: "Frasco 1L", volume: 1, unidade: "L" },
  { nome: "Bisnaga 1,5kg", volume: 1.5, unidade: "kg" },
  { nome: "Bombona 4L", volume: 4, unidade: "L" },
  { nome: "Bombona 5L", volume: 5, unidade: "L" },
  { nome: "Caixa Frascos 60x100ml", volume: 6, unidade: "L" },
  { nome: "Caixa Sachês 100x80g", volume: 8, unidade: "kg" },
  { nome: "Caixa Frascos 48x200ml", volume: 9.6, unidade: "L" },
  { nome: "Balde 10Kg", volume: 10, unidade: "kg" },
  { nome: "Caixa Frascos 12x900ml", volume: 10.8, unidade: "L" },
  { nome: "Caixa Potes 12x1Kg", volume: 12, unidade: "kg" },
  { nome: "Caixa Frascos 12x1L", volume: 12, unidade: "L" },
  { nome: "Caixa Potes 36x500g", volume: 18, unidade: "kg" },
  { nome: "Balde 18Kg", volume: 18, unidade: "kg" },
  { nome: "Bombona 19L", volume: 19, unidade: "L" },
  { nome: "Balde 20Kg", volume: 20, unidade: "kg" },
  { nome: "Bombona 20L", volume: 20, unidade: "L" },
  { nome: "Caixa Bombonas 4x4L", volume: 16, unidade: "L" },
  { nome: "Caixa Bombonas 4x5L", volume: 20, unidade: "L" },
  { nome: "Caixa Sachês 16x1,5Kg", volume: 24, unidade: "kg" },
  { nome: "Caixa Potes 24x1Kg", volume: 24, unidade: "kg" },
  { nome: "Caixa Frascos 24x1L", volume: 24, unidade: "L" },
  { nome: "Tamborete 60L", volume: 60, unidade: "L" },
  { nome: "Tambor 170Kg", volume: 170, unidade: "kg" },
  { nome: "Tambor 200L", volume: 200, unidade: "L" },
  { nome: "Tambor 209L", volume: 209, unidade: "L" },
  { nome: "Container 1000L", volume: 1000, unidade: "L" },
  { nome: "Granel", volume: null, unidade: null },
];

export function embalagemInfo(nome: string | null | undefined) {
  const k = chaveTexto(nome);
  return EMBALAGENS.find((e) => chaveTexto(e.nome) === k) ?? null;
}

// Volume em litros ou quilos lido do texto da embalagem ("Bombona 20L" = 20 L,
// "Caixa 12x900ml" = 10,8 L, "Bisnaga 80g" = 0,08 kg). Mesma regra de
// public.volume_embalagem() no banco: mude os dois juntos.
export function volumeDaEmbalagem(nome: string | null | undefined): { volume: number; unidade: "L" | "kg" } | null {
  const t = (nome || "").toLowerCase().replace(/,/g, ".");
  const un = "(ml|litros?|lts?|l|kgs?|gr|g)(?![a-z])";
  const num = "(\\d+(?:\\.\\d+)?(?:/\\d+)?)";
  let qtd = 1;
  let txt: string;
  let u: string;
  const multi = new RegExp(`(\\d+)\\s*x\\s*${num}\\s*${un}`).exec(t);
  if (multi) {
    qtd = Number(multi[1]);
    txt = multi[2];
    u = multi[3];
  } else {
    const simples = new RegExp(`${num}\\s*${un}`).exec(t);
    if (!simples) return null;
    txt = simples[1];
    u = simples[2];
  }
  let valor = txt.includes("/") ? Number(txt.split("/")[0]) / Number(txt.split("/")[1]) : Number(txt);
  if (["ml", "g", "gr"].includes(u)) valor = valor / 1000;
  const volume = Math.round(qtd * valor * 10000) / 10000;
  if (!Number.isFinite(volume) || volume <= 0) return null;
  return { volume, unidade: /^(kg|kgs|g|gr)$/.test(u) ? "kg" : "L" };
}

export const UFS: { sigla: string; nome: string }[] = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
];

export function ufDoNome(nome: string | null | undefined): string | null {
  const k = chaveTexto(nome);
  if (!k) return null;
  const uf = UFS.find((u) => chaveTexto(u.nome) === k || u.sigla.toLowerCase() === k);
  return uf ? uf.sigla : null;
}

// Marcas que aparecem no autocompletar mesmo antes de alguém pesquisar.
export const MARCAS_BASE = [
  "Bardahl",
  "Castrol",
  "Elaion",
  "Evora",
  "Ipiranga",
  "Karter",
  "Lubrax",
  "Mobil",
  "Petronas",
  "Shell",
  "Texaco",
  "TotalEnergies",
  "Valvoline",
];

// Especificações de desempenho mais comuns, para marcar com um toque no
// formulário. O vendedor também pode digitar qualquer outra.
export const DESEMPENHOS = [
  // Os 10 primeiros aparecem direto; o resto em "mais...".
  "API SP",
  "API SN",
  "API CK-4",
  "API CI-4",
  "API GL-5",
  "ACEA C3",
  "ACEA E7",
  "DEXOS 1 Gen 3",
  "ILSAC GF-6",
  "JASO MA2",
  "API SQ",
  "API SN Plus",
  "API SL",
  "API CJ-4",
  "API CH-4",
  "API CF",
  "API GL-4",
  "ACEA A3/B4",
  "ACEA C2",
  "ACEA E9",
  "DEXOS 2",
  "MB 228.3",
  "Volvo VDS-4.5",
  "Allison C-4",
];

// "API SP, ACEA C3" <-> ["API SP", "ACEA C3"]
export function separarDesempenho(texto: string | null | undefined): string[] {
  return (texto || "")
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
