/**
 * Vista Empleados (solo dueño): especialidad y color (U2), edición y baja (H15/H16), y accesibilidad (U1).
 * Sin API: onCreate/onUpdate son simulados.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmpleadosView } from './EmpleadosView';

const equipo = [
  { id: 'a', name: 'Julián Patiño', email: 'julian@x.test', specialty: 'Fade y barba', color: '#007A6E', active: true },
  { id: 'b', name: 'Camilo Reyes', email: 'camilo@x.test', specialty: '', color: '#4F46E5', active: true },
  { id: 'c', name: 'Sebastián Ortiz', email: 'sebas@x.test', specialty: 'Tratamientos', color: '#D9930B', active: false },
];

const montar = (over = {}) => {
  const props = {
    equipo,
    onCreate: vi.fn().mockResolvedValue({ ok: true }),
    onUpdate: vi.fn().mockResolvedValue({ ok: true, user: {} }),
    ...over,
  };
  render(<EmpleadosView {...props} />);
  return { user: userEvent.setup(), ...props };
};

describe('lista del equipo (U2)', () => {
  it('muestra nombre, especialidad (o «Sin especialidad»), correo y estado de cada barbero', () => {
    montar();
    expect(screen.getByText('Julián Patiño')).toBeInTheDocument();
    expect(screen.getByText('Fade y barba')).toBeInTheDocument();
    expect(screen.getByText('Sin especialidad')).toBeInTheDocument();
    expect(screen.getByText('julian@x.test')).toBeInTheDocument();
    expect(screen.getAllByText('Activo')).toHaveLength(2);
    expect(screen.getByText('Desactivado')).toBeInTheDocument();
  });

  it('ya no hay una columna «Rol» que siempre dice lo mismo', () => {
    montar();
    expect(screen.queryByRole('columnheader', { name: 'Rol' })).toBeNull();
    expect(screen.queryByText('Empleado')).toBeNull();
  });

  it('resume cuántos están activos y cuántos desactivados', () => {
    montar();
    expect(screen.getByText(/2 activos · 1 desactivado/)).toBeInTheDocument();
  });

  it('un equipo vacío muestra el mensaje de vacío en español', () => {
    montar({ equipo: [] });
    expect(screen.getByText('Todavía no tienes empleados registrados.')).toBeInTheDocument();
  });

  it('cada fila tiene acciones con nombre accesible que dicen sobre quién actúan', () => {
    montar();
    expect(screen.getByRole('button', { name: 'Editar a Julián Patiño' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desactivar a Julián Patiño' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reactivar a Sebastián Ortiz' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desactivar a Sebastián Ortiz' })).toBeNull();
  });
});

describe('alta de un empleado', () => {
  const abrir = async () => {
    const ctx = montar();
    await ctx.user.click(screen.getByRole('button', { name: /Nuevo empleado/ }));
    return ctx;
  };

  it('el formulario es un diálogo accesible con todos sus campos etiquetados (U1)', async () => {
    await abrir();
    const d = screen.getByRole('dialog', { name: 'Nuevo empleado' });
    for (const campo of ['Nombre', 'Especialidad (opcional)', 'Correo', 'Contraseña temporal']) {
      expect(within(d).getByLabelText(campo)).toBeInTheDocument();
    }
  });

  it('conserva lo que exige la prueba de humo: .max-w-sm, nombre sin tipo primero, email y password', async () => {
    await abrir();
    const modal = document.querySelector('.max-w-sm');
    expect(modal.querySelector('input:not([type])')).toBe(screen.getByLabelText('Nombre'));
    expect(modal.querySelector('input[type="email"]')).toBeTruthy();
    expect(modal.querySelector('input[type="password"]')).toBeTruthy();
  });

  it('el foco entra al campo Nombre y Escape cierra el formulario', async () => {
    const { user } = await abrir();
    expect(screen.getByLabelText('Nombre')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each([
    { caso: 'sin nombre', datos: { correo: 'a@b.co', clave: 'Clave1234' }, mensaje: 'Ingresa el nombre del empleado.' },
    { caso: 'correo inválido', datos: { nombre: 'Ana Prueba', correo: 'no-es-correo', clave: 'Clave1234' }, mensaje: 'Ingresa un correo válido.' },
    { caso: 'contraseña débil', datos: { nombre: 'Ana Prueba', correo: 'a@b.co', clave: 'corta' }, mensaje: 'La contraseña debe tener al menos 8 caracteres, con letras y números.' },
    { caso: 'especialidad demasiado larga', datos: { nombre: 'Ana Prueba', esp: 'x'.repeat(61), correo: 'a@b.co', clave: 'Clave1234' }, mensaje: 'La especialidad es demasiado larga (máximo 60 caracteres).' },
  ])('$caso → muestra «$mensaje» y no llama al servidor', async ({ datos, mensaje }) => {
    const { user, onCreate } = await abrir();
    if (datos.nombre) await user.type(screen.getByLabelText('Nombre'), datos.nombre);
    if (datos.esp) await user.type(screen.getByLabelText('Especialidad (opcional)'), datos.esp);
    if (datos.correo) await user.type(screen.getByLabelText('Correo'), datos.correo);
    if (datos.clave) await user.type(screen.getByLabelText('Contraseña temporal'), datos.clave);
    await user.click(screen.getByRole('button', { name: 'Crear empleado' }));
    expect(screen.getByRole('alert')).toHaveTextContent(mensaje);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('con datos válidos llama a onCreate con nombre, especialidad, correo y contraseña, y cierra', async () => {
    const { user, onCreate } = await abrir();
    await user.type(screen.getByLabelText('Nombre'), 'Ana Prueba');
    await user.type(screen.getByLabelText('Especialidad (opcional)'), 'Barba');
    await user.type(screen.getByLabelText('Correo'), 'ana@b.co');
    await user.type(screen.getByLabelText('Contraseña temporal'), 'Clave1234');
    await user.click(screen.getByRole('button', { name: 'Crear empleado' }));
    expect(onCreate).toHaveBeenCalledWith({ name: 'Ana Prueba', specialty: 'Barba', email: 'ana@b.co', password: 'Clave1234' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('si el servidor rechaza (p. ej. correo repetido), muestra su mensaje y deja abierto el formulario', async () => {
    const { user } = montar({ onCreate: vi.fn().mockResolvedValue({ ok: false, error: 'Ya existe una cuenta con este correo.' }) });
    await user.click(screen.getByRole('button', { name: /Nuevo empleado/ }));
    await user.type(screen.getByLabelText('Nombre'), 'Ana Prueba');
    await user.type(screen.getByLabelText('Correo'), 'ana@b.co');
    await user.type(screen.getByLabelText('Contraseña temporal'), 'Clave1234');
    await user.click(screen.getByRole('button', { name: 'Crear empleado' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe una cuenta con este correo.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('edición (H16)', () => {
  it('abre con los datos del empleado y envía solo lo que se pide cambiar', async () => {
    const { user, onUpdate } = montar();
    await user.click(screen.getByRole('button', { name: 'Editar a Julián Patiño' }));
    const nombre = screen.getByLabelText('Nombre');
    expect(nombre).toHaveValue('Julián Patiño');
    expect(screen.getByLabelText('Especialidad (opcional)')).toHaveValue('Fade y barba');
    await user.clear(nombre);
    await user.type(nombre, 'Julián P.');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(onUpdate).toHaveBeenCalledWith('a', { name: 'Julián P.', specialty: 'Fade y barba' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('con una contraseña nueva la incluye; sin ella, no', async () => {
    const { user, onUpdate } = montar();
    await user.click(screen.getByRole('button', { name: 'Editar a Camilo Reyes' }));
    await user.type(screen.getByLabelText('Nueva contraseña (opcional)'), 'ClaveNueva2026');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(onUpdate).toHaveBeenCalledWith('b', { name: 'Camilo Reyes', specialty: '', password: 'ClaveNueva2026' });
  });

  it('una contraseña nueva débil se rechaza antes de llamar al servidor', async () => {
    const { user, onUpdate } = montar();
    await user.click(screen.getByRole('button', { name: 'Editar a Camilo Reyes' }));
    await user.type(screen.getByLabelText('Nueva contraseña (opcional)'), 'corta');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(screen.getByRole('alert')).toHaveTextContent('al menos 8 caracteres');
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('avisa de que la contraseña nueva cierra sus sesiones y de que el correo no se edita', async () => {
    const { user } = montar();
    await user.click(screen.getByRole('button', { name: 'Editar a Julián Patiño' }));
    expect(screen.getByText(/se cierran las sesiones que Julián Patiño tenga abiertas/)).toBeInTheDocument();
    expect(screen.getByText(/El correo no se puede modificar/)).toBeInTheDocument();
  });
});

describe('baja y reactivación (H15)', () => {
  it('desactivar pide confirmación y explica qué pasa; Cancelar no cambia nada', async () => {
    const { user, onUpdate } = montar();
    await user.click(screen.getByRole('button', { name: 'Desactivar a Julián Patiño' }));
    const d = screen.getByRole('dialog', { name: '¿Desactivar a Julián Patiño?' });
    expect(d).toHaveTextContent('Perderá el acceso de inmediato');
    expect(d).toHaveTextContent('se conservan');
    await user.click(within(d).getByRole('button', { name: 'Cancelar' }));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('confirmar llama a onUpdate con active:false y avisa cuántas citas pendientes le quedan', async () => {
    const { user, onUpdate } = montar({ onUpdate: vi.fn().mockResolvedValue({ ok: true, pendingAppointments: 3 }) });
    await user.click(screen.getByRole('button', { name: 'Desactivar a Julián Patiño' }));
    await user.click(screen.getByRole('button', { name: 'Desactivar' }));
    expect(onUpdate).toHaveBeenCalledWith('a', { active: false });
    expect(await screen.findByRole('status')).toHaveTextContent('Julián Patiño ya no tiene acceso. Le quedan 3 citas pendientes: reasígnalas desde la agenda.');
  });

  it('usa el singular con 1 cita y no menciona citas si no tiene ninguna', async () => {
    const { user } = montar({ onUpdate: vi.fn().mockResolvedValueOnce({ ok: true, pendingAppointments: 1 }).mockResolvedValue({ ok: true, pendingAppointments: 0 }) });
    await user.click(screen.getByRole('button', { name: 'Desactivar a Julián Patiño' }));
    await user.click(screen.getByRole('button', { name: 'Desactivar' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Le quedan 1 cita pendiente:');
    await user.click(screen.getByRole('button', { name: 'Entendido' }));
    await user.click(screen.getByRole('button', { name: 'Desactivar a Camilo Reyes' }));
    await user.click(screen.getByRole('button', { name: 'Desactivar' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Camilo Reyes ya no tiene acceso. Su historial se conserva.');
  });

  it('si el servidor falla, muestra el error dentro de la confirmación y no la cierra', async () => {
    const { user } = montar({ onUpdate: vi.fn().mockResolvedValue({ ok: false, error: 'Empleado no encontrado.' }) });
    await user.click(screen.getByRole('button', { name: 'Desactivar a Julián Patiño' }));
    await user.click(screen.getByRole('button', { name: 'Desactivar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Empleado no encontrado.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('reactivar es directo (sin confirmación) y avisa de que debe iniciar sesión de nuevo', async () => {
    const { user, onUpdate } = montar();
    await user.click(screen.getByRole('button', { name: 'Reactivar a Sebastián Ortiz' }));
    expect(onUpdate).toHaveBeenCalledWith('c', { active: true });
    expect(await screen.findByRole('status')).toHaveTextContent('Sebastián Ortiz fue reactivado. Para entrar debe iniciar sesión de nuevo.');
  });
});
