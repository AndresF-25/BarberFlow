import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';

/* Equipo del negocio: lista de empleados y alta de nuevos. */
export function useEmpleados() {
  const { createEmployee, listEmployees } = useAuth();
  const [empleados, setEmpleados] = useState([]);
  const [version, setVersion] = useState(0); // fuerza refresco tras crear un empleado

  useEffect(() => {
    let active = true;
    (async () => {
      const list = await listEmployees();
      if (active) setEmpleados(list);
    })();
    return () => { active = false; };
  }, [listEmployees, version]);

  const create = async (data) => {
    const result = await createEmployee(data);
    if (result.ok) setVersion(v => v + 1);
    return result;
  };

  return { empleados, create };
}
