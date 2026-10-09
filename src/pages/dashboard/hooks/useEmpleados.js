import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';

/* Equipo del negocio.
 *   equipo     → todos (incluidos los desactivados, solo para el dueño): lo usa la vista Empleados.
 *   empleados  → solo los activos: lo usan la agenda y «Nueva cita» (no se asigna a quien ya no trabaja ahí). */
export function useEmpleados() {
  const { createEmployee, updateEmployee, listEmployees } = useAuth();
  const [equipo, setEquipo] = useState([]);
  const [version, setVersion] = useState(0); // fuerza refresco tras crear o modificar un empleado

  useEffect(() => {
    let active = true;
    (async () => {
      const list = await listEmployees({ includeInactive: true });
      if (active) setEquipo(list);
    })();
    return () => { active = false; };
  }, [listEmployees, version]);

  const create = async (data) => {
    const result = await createEmployee(data);
    if (result.ok) setVersion(v => v + 1);
    return result;
  };

  const update = async (id, patch) => {
    const result = await updateEmployee(id, patch);
    if (result.ok) setVersion(v => v + 1);
    return result;
  };

  const empleados = equipo.filter(e => e.active !== false);
  return { empleados, equipo, create, update };
}
