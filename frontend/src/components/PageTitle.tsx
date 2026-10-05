import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { titleForPath } from '../utils/pageTitle';

/** Atualiza o título da aba a cada rota (ver utils/pageTitle.ts). */
export function PageTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = titleForPath(pathname);
  }, [pathname]);
  return null;
}
