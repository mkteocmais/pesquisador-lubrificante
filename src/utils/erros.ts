// Nunca mostra o erro cru do Supabase: traduz para algo que o vendedor entenda.
export function mensagemErro(e: unknown, padrao = "Não foi possível concluir agora. Tente de novo em instantes."): string {
  const msg = (e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "").toLowerCase();
  if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("load failed"))
    return "Sem conexão com a internet. Confira o sinal e tente de novo.";
  if (msg.includes("row-level security") || msg.includes("permission") || msg.includes("acesso negado"))
    return "Você não tem permissão para fazer isso. Fale com o administrador.";
  if (msg.includes("jwt") || msg.includes("session")) return "Sua sessão expirou. Entre de novo.";
  if (msg.includes("payload too large") || msg.includes("exceeded the maximum")) return "A foto é grande demais. Tente outra.";
  if (msg.includes("próprio acesso de administrador")) return "Você não pode tirar o seu próprio acesso de administrador.";
  return padrao;
}
