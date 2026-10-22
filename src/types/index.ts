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
  // Especificações de desempenho ("API SP, ACEA C3").
  desempenho: string | null;
  // Fluxo de venda ("Distribuidor -> Revendedor" etc., ver FLUXOS).
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
  "empresa" | "estado" | "cidade" | "marca" | "produto" | "viscosidade" | "desempenho" | "cliente" | "sku" | "preco" | "produto_ref_id"
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

// Comparação de um grupo de produtos: pelo mesmo SKU (embalagem) e por
// litro/quilo (qualquer embalagem). Sempre no mesmo fluxo de venda.
export interface Comparacao {
  sku: Recorte;
  litro: Recorte | null;
}

export interface Devolutiva {
  preco: number;
  volume: number | null;
  // Todos ligados ao mesmo equivalente Evora.
  equivalente: Comparacao | null;
  // O mesmo produto do concorrente (marca + nome) pesquisado por outros.
  mesmo_produto: Comparacao | null;
}

// Cadastros mantidos pelos administradores (alimentam o autocompletar).
export interface CadMarca {
  id: string;
  nome: string;
  ativo: boolean;
  revisado: boolean;
}

export interface CadProduto {
  id: string;
  marca_id: string;
  nome: string;
  viscosidade: string | null;
  desempenho: string | null;
  ativo: boolean;
  revisado: boolean;
}

export interface CadEmpresa {
  id: string;
  nome: string;
  cidade: string | null;
  uf: string | null;
  ativo: boolean;
  revisado: boolean;
}

export interface Cadastros {
  marcas: CadMarca[];
  produtos: CadProduto[];
  empresas: CadEmpresa[];
}

// Concorrente já pesquisado por alguém (para o autocompletar).
export interface Concorrente {
  marca: string;
  produto: string | null;
  viscosidade: string | null;
  usos: number;
}

// Linha do ranking de envios (sem preço).
export interface RankingLinha {
  vendedor: string;
  envios: number;
  eu: boolean;
}

// Item da base de equivalências visível para todos (sem preço nem autor).
export interface Equivalencia {
  marca: string;
  produto: string | null;
  viscosidade: string | null;
  produto_id: string;
  usos: number;
  ultimo: string;
}

export type Aba = "lancar" | "meus" | "equivalencias" | "painel";
