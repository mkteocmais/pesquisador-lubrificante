import { supabase, BUCKET_FOTOS } from "./supabaseClient";
import { reduzirFoto } from "../utils/foto";
import type { Cadastros, Devolutiva, Equivalencia, Lancamento, NovoLancamento, Perfil, Produto, RankingLinha } from "../types";

// Único lugar do app que fala com o banco. As telas recebem dados já tipados e
// erros como Error (a mensagem amigável fica com quem mostra o toast).

export async function carregarPerfil(userId: string): Promise<Perfil | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data as Perfil | null;
}

export async function salvarMeuNome(nome: string): Promise<void> {
  const { error } = await supabase.rpc("atualizar_meu_nome", { p_nome: nome });
  if (error) throw error;
}

export async function carregarProdutos(): Promise<Produto[]> {
  const { data, error } = await supabase.from("produtos").select("*").order("nome").limit(5000);
  if (error) throw error;
  return (data ?? []) as Produto[];
}

// Empresas, marcas e produtos de concorrentes para o autocompletar. O
// administrador recebe também os arquivados (RLS).
export async function carregarCadastros(): Promise<Cadastros> {
  const [m, p, e] = await Promise.all([
    supabase.from("cad_marcas").select("id, nome, ativo, revisado").order("nome").limit(5000),
    supabase.from("cad_produtos").select("id, marca_id, nome, viscosidade, desempenho, ativo, revisado").order("nome").limit(10000),
    supabase.from("cad_empresas").select("id, nome, cidade, uf, ativo, revisado").order("nome").limit(10000),
  ]);
  if (m.error) throw m.error;
  if (p.error) throw p.error;
  if (e.error) throw e.error;
  return { marcas: m.data ?? [], produtos: p.data ?? [], empresas: e.data ?? [] } as Cadastros;
}

export async function adminSalvarMarca(id: string | null, nome: string): Promise<string> {
  const { data, error } = await supabase.rpc("admin_salvar_marca", { p_id: id, p_nome: nome });
  if (error) throw error;
  return data as string;
}

export async function adminSalvarProduto(p: {
  id: string | null;
  marca_id: string | null;
  nome: string;
  viscosidade: string | null;
  desempenho: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("admin_salvar_produto", {
    p_id: p.id,
    p_marca_id: p.marca_id,
    p_nome: p.nome,
    p_viscosidade: p.viscosidade,
    p_desempenho: p.desempenho,
  });
  if (error) throw error;
  return data as string;
}

export async function adminSalvarEmpresa(p: { id: string | null; nome: string; cidade: string | null; uf: string | null }): Promise<string> {
  const { data, error } = await supabase.rpc("admin_salvar_empresa", { p_id: p.id, p_nome: p.nome, p_cidade: p.cidade, p_uf: p.uf });
  if (error) throw error;
  return data as string;
}

export async function adminStatusCadastro(tipo: "marca" | "produto" | "empresa", id: string, mudanca: { ativo?: boolean; revisado?: boolean }) {
  const { error } = await supabase.rpc("admin_status_cadastro", {
    p_tipo: tipo,
    p_id: id,
    p_ativo: mudanca.ativo ?? null,
    p_revisado: mudanca.revisado ?? null,
  });
  if (error) throw error;
}

export async function sugerirEquivalente(marca: string, produto: string): Promise<{ produto_id: string; usos: number }[]> {
  const { data, error } = await supabase.rpc("sugerir_equivalente", { p_marca: marca, p_produto: produto });
  if (error) throw error;
  return ((data ?? []) as { produto_id: string; usos: number }[]).map((s) => ({ ...s, usos: Number(s.usos) }));
}

export async function rankingEnvios(desde: Date | null): Promise<RankingLinha[]> {
  const { data, error } = await supabase.rpc("ranking_envios", { p_desde: desde ? desde.toISOString() : null });
  if (error) throw error;
  return ((data ?? []) as RankingLinha[]).map((r) => ({ ...r, envios: Number(r.envios), eu: !!r.eu }));
}

export async function baseEquivalencias(): Promise<Equivalencia[]> {
  const { data, error } = await supabase.rpc("base_equivalencias");
  if (error) throw error;
  return ((data ?? []) as Equivalencia[]).map((e) => ({ ...e, usos: Number(e.usos) }));
}

export async function devolutiva(id: string): Promise<Devolutiva | null> {
  const { data, error } = await supabase.rpc("devolutiva_preco", { p_id: id });
  if (error) throw error;
  return data as Devolutiva | null;
}

function normalizar(l: Lancamento): Lancamento {
  return { ...l, preco: Number(l.preco) };
}

export async function meusLancamentos(userId: string): Promise<Lancamento[]> {
  const { data, error } = await supabase
    .from("lubricants")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return ((data ?? []) as Lancamento[]).map(normalizar);
}

// Administrador: todos os lançamentos, em páginas de 1000 (limite do PostgREST).
export async function todosLancamentos(): Promise<Lancamento[]> {
  const todos: Lancamento[] = [];
  const pagina = 1000;
  for (let de = 0; ; de += pagina) {
    const { data, error } = await supabase
      .from("lubricants")
      .select("*")
      .order("created_at", { ascending: false })
      .range(de, de + pagina - 1);
    if (error) throw error;
    const lote = (data ?? []) as Lancamento[];
    todos.push(...lote.map(normalizar));
    if (lote.length < pagina) break;
  }
  return todos;
}

async function enviarFoto(userId: string, arquivo: File): Promise<string> {
  const blob = await reduzirFoto(arquivo);
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  // A pasta com o id do vendedor é exigida pela policy do Storage.
  const caminho = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET_FOTOS).upload(caminho, blob, {
    contentType: blob.type || "image/jpeg",
  });
  if (error) throw error;
  return supabase.storage.from(BUCKET_FOTOS).getPublicUrl(caminho).data.publicUrl;
}

export async function salvarLancamento(params: {
  perfil: Perfil;
  dados: NovoLancamento;
  foto: File | null;
  id?: string;
}): Promise<Lancamento> {
  const { perfil, dados, foto, id } = params;
  const foto_url = foto ? await enviarFoto(perfil.id, foto) : undefined;
  const linha = { ...dados, ...(foto_url ? { foto_url } : {}) };
  if (id) {
    const { data, error } = await supabase.from("lubricants").update(linha).eq("id", id).select("*").single();
    if (error) throw error;
    return normalizar(data as Lancamento);
  }
  const { data, error } = await supabase
    .from("lubricants")
    .insert({ ...linha, user_id: perfil.id, colaborador: perfil.nome })
    .select("*")
    .single();
  if (error) throw error;
  return normalizar(data as Lancamento);
}

export async function excluirLancamento(id: string): Promise<void> {
  const { error } = await supabase.from("lubricants").delete().eq("id", id);
  if (error) throw error;
}

// ---- Administrador ----------------------------------------------------------

export async function carregarPerfis(): Promise<Perfil[]> {
  const { data, error } = await supabase.from("profiles").select("*").order("nome");
  if (error) throw error;
  return (data ?? []) as Perfil[];
}

export async function adminAtualizarPerfil(p: Pick<Perfil, "id" | "nome" | "estado" | "papel" | "ativo">): Promise<void> {
  const { error } = await supabase.rpc("admin_atualizar_perfil", {
    p_id: p.id,
    p_nome: p.nome,
    p_estado: p.estado,
    p_papel: p.papel,
    p_ativo: p.ativo,
  });
  if (error) throw error;
}

// Atualiza vários lançamentos de uma vez (vincular equivalente, atribuir
// lançamentos antigos a um vendedor). Em lotes para não estourar a URL.
export async function atualizarVarios(ids: string[], campos: Partial<Pick<Lancamento, "produto_ref_id" | "user_id" | "colaborador">>) {
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await supabase.from("lubricants").update(campos).in("id", ids.slice(i, i + 200));
    if (error) throw error;
  }
}
