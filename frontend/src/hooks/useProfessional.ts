import { useEffect, useState } from 'react';
import { ProfessionalsApi } from '../api/endpoints';
import type { Professional } from '../api/types';

/**
 * Este CRM é usado por uma única profissional (consultora principal) — ver
 * docs/04-plano-implementacao.md. Em vez de espalhar seletor de
 * "profissional" pelas telas, a UI carrega a única profissional ativa uma
 * vez aqui. Se no futuro houver mais de uma, este é o único lugar a trocar
 * por um seletor de verdade.
 */
export function useProfessional() {
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ProfessionalsApi.list()
      .then((res) => setProfessional(res.data[0] ?? null))
      .finally(() => setLoading(false));
  }, []);

  return { professional, loading };
}
