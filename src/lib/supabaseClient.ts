import { createClient } from "@supabase/supabase-js";

// URL e chave publicável do projeto "PesquisaLubrificantes". As duas são
// públicas por definição (vão para o navegador de qualquer jeito): quem protege
// os dados são as policies de RLS no banco. As variáveis de ambiente só servem
// para apontar o app para outro projeto.
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || "https://udbaskofvhcaudyeolrd.supabase.co";
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || "sb_publishable_Yp-LdHAENWBZByTStXKjnw_iN41jrm3";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const BUCKET_FOTOS = "fotos-lubrificantes";
