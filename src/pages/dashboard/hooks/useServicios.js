import { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { attempt } from './attempt';

/* Catálogo de servicios (CRUD contra la API). Cada acción devuelve { ok, error }. */
export function useServicios() {
  const [servicios, setServicios] = useState([]);
  const [estado, setEstado] = useState({ loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { services } = await api.listServices();
        if (!cancelled) {
          setServicios(services || []);
          setEstado({ loading: false, error: '' });
        }
      } catch (err) {
        if (!cancelled) setEstado({ loading: false, error: err.message });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const add = (data) => attempt(async () => {
    const { service } = await api.createService(data);
    setServicios(prev => [...prev, service]);
  });

  const edit = (id, data) => attempt(async () => {
    const { service } = await api.updateService(id, data);
    setServicios(prev => prev.map(s => s.id === id ? service : s));
  });

  const remove = (id) => attempt(async () => {
    await api.deleteService(id);
    setServicios(prev => prev.filter(s => s.id !== id));
  });

  return { servicios, estado, add, edit, remove };
}
