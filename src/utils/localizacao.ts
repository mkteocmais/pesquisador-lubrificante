import { ufDoNome } from "./options";

export interface Local {
  latLong: string;
  cidade: string | null;
  uf: string | null;
}

// Pega o GPS e descobre cidade/UF pelo OpenStreetMap (mesmo serviço do app
// antigo). Se o vendedor negar o GPS ou estiver sem sinal, devolve null e o
// formulário segue com digitação manual.
export function buscarLocal(): Promise<Local | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const latLong = `${latitude}, ${longitude}`;
        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&accept-language=pt-BR&lat=${latitude}&lon=${longitude}`
          );
          const data = await resp.json();
          const a = data?.address ?? {};
          const iso: string | undefined = a["ISO3166-2-lvl4"];
          const uf = iso?.startsWith("BR-") ? iso.slice(3) : ufDoNome(a.state);
          resolve({ latLong, cidade: a.city || a.town || a.village || a.municipality || null, uf });
        } catch {
          resolve({ latLong, cidade: null, uf: null });
        }
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 }
    );
  });
}
