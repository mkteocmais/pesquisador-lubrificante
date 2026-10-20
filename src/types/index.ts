// Tipos que espelham as tabelas do Supabase (atualizar junto com as migrações).

export type Papel = "vendedor" | "admin";

export interface Perfil {
  id: string;
  email: string;
  nome: string | null;
  estado: string | null;
  papel: Papel;
  ativo: boolean;
  created_at: string;
}

// Linha comercial do nosso catálogo (tabela produtos).
export interface Produto {
  id: string;
  nome: string;
  tipo: string | null;
  viscosidade: string | null;
  especificacao: string | null;
  base: string | null;
  aplicacao: string | null;
  ativo: boolean;
}

// Um preço pesquisado (tabela lubricants, nome herdado do app antigo).
export interface Lancamento {
  id: string;
  created_at: string;
  updated_at: string | null;
  user_id: string | null;
  colaborador: string | null;
  empresa: string | null;
  estado: string | null;
  cidade: string | null;
  marca: string | null;
  produto: string | null;
  viscosidade: string | null;
  // Fluxo de venda ("Distribuidor -> Revenda" etc.).
  cliente: string | null;
  // Embalagem pesquisada.
  sku: string | null;
  unidade: string | null;
  preco: number;
  localizacao: string | null;
  foto_url: string | null;
  produto_ref_id: string | null;
  dados_originais: Record<string, string> | null;
}

export type NovoLancamento = Pick<
  Lancamento,
  "empresa" | "estado" | "cidade" | "marca" | "produto" | "viscosidade" | "cliente" | "sku" | "preco" | "produto_ref_id"
> & { localizacao?: string | null };

export interface Estatistica {
  n: number;
  mediana?: number;
  minimo?: number;
  maximo?: number;
}

export interface Recorte {
  estado: Estatistica | null;
  brasil: Estatistica | null;
}

export interface Devolutiva {
  preco: number;
  equivalente: Recorte | null;
  viscosidade: Recorte | null;
}

// Concorrente já pesquisado por alguém (para o autocompletar).
export interface Concorrente {
  marca: string;
  produto: string | null;
  viscosidade: string | null;
  usos: number;
}

export type Aba = "lancar" | "meus" | "painel";
