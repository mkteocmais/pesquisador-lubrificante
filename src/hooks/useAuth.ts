import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

interface UseAuthResult {
  user: User | null;
  authLoading: boolean;
}

/**
 * Mantém o estado da sessão do Supabase Auth sincronizado.
 * Não expõe ações de login/cadastro/logout porque estas hoje só são
 * usadas dentro da própria tela de autenticação e do modal de perfil,
 * onde continuam chamando `supabase.auth` diretamente.
 */
export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return { user, authLoading };
}
