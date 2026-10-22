import { chaveTexto } from "./format";

// "Auditoria de similaridade": compara nomes pelos pedaços de 3 letras que
// têm em comum (coeficiente de Dice). "Kater" x "Karter" ≈ 0,6; nomes sem
// relação ficam perto de 0. Usado para sugerir "Você quis dizer...?" no
// formulário e para apontar cadastros duplicados no Painel.

function trigramas(s: string): Map<string, number> {
  const t = `  ${chaveTexto(s)} `;
  const m = new Map<string, number>();
  for (let i = 0; i < t.length - 2; i++) {
    const g = t.slice(i, i + 3);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

export function similaridade(a: string, b: string): number {
  const ka = chaveTexto(a);
  const kb = chaveTexto(b);
  if (!ka || !kb) return 0;
  if (ka === kb) return 1;
  const ta = trigramas(ka);
  const tb = trigramas(kb);
  let comum = 0;
  let total = 0;
  ta.forEach((n, g) => {
    comum += Math.min(n, tb.get(g) ?? 0);
    total += n;
  });
  tb.forEach((n) => (total += n));
  return total ? (2 * comum) / total : 0;
}

// O mais parecido de uma lista, se passar do limite.
export function maisParecido<T>(texto: string, itens: T[], rotulo: (t: T) => string, limite = 0.5): { item: T; nota: number } | null {
  let melhor: { item: T; nota: number } | null = null;
  for (const item of itens) {
    const nota = similaridade(texto, rotulo(item));
    if (!melhor || nota > melhor.nota) melhor = { item, nota };
  }
  return melhor && melhor.nota >= limite ? melhor : null;
}
