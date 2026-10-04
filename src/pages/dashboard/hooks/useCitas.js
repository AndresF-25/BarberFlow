import { useState, useEffect } from 'react';
import { api } from '../../../api/client';

/* Citas reales entre dos fechas. `version` fuerza la recarga tras crear/modificar una cita. */
export function useCitas(from, to, version) {
  const [state, setState] = useState({ citas: [], loading: true, error: '' });
  useEffect(() => {
    let cancelled = false;
    setState(s => ({ ...s, loading: true }));
    api.listAppointments({ from, to })
      .then(({ appointments }) => { if (!cancelled) setState({ citas: appointments || [], loading: false, error: '' }); })
      .catch(err => { if (!cancelled) setState({ citas: [], loading: false, error: err.message }); });
    return () => { cancelled = true; };
  }, [from, to, version]);
  return state;
}
