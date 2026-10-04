import { useState, useEffect } from 'react';

/* Carga genérica de un endpoint de analíticas. `deps` decide cuándo volver a pedirlo. */
export function useApi(fetcher, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  useEffect(() => {
    let cancelled = false;
    setState(s => ({ ...s, loading: true }));
    fetcher()
      .then(data => { if (!cancelled) setState({ data, loading: false, error: '' }); })
      .catch(err => { if (!cancelled) setState({ data: null, loading: false, error: err.message }); });
    return () => { cancelled = true; };
    // `fetcher` se recrea en cada render; solo `deps` decide cuándo volver a pedir.
  }, deps);
  return state;
}
