/**
 * Cambio de contraseña propio (H16): validación previa, mensajes del servidor y estado final.
 * `useAuth` está simulado: no hay API.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangePasswordModal } from './ChangePasswordModal';

const changePassword = vi.fn();
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ changePassword }) }));

const montar = (onClose = vi.fn()) => {
  render(<ChangePasswordModal onClose={onClose} />);
  return { user: userEvent.setup(), onClose };
};
const llenar = async (user, actual, nueva, repetir) => {
  if (actual) await user.type(screen.getByLabelText('Contraseña actual'), actual);
  if (nueva) await user.type(screen.getByLabelText('Contraseña nueva'), nueva);
  if (repetir) await user.type(screen.getByLabelText('Repite la contraseña nueva'), repetir);
  await user.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
};

describe('ChangePasswordModal', () => {
  beforeEach(() => { changePassword.mockReset(); });

  it('es un diálogo accesible con sus tres campos etiquetados y autocompletado correcto', () => {
    montar();
    expect(screen.getByRole('dialog', { name: 'Cambiar contraseña' })).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña actual')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByLabelText('Contraseña nueva')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText('Repite la contraseña nueva')).toHaveAttribute('type', 'password');
  });

  it.each([
    { caso: 'sin la actual', args: [null, 'ClaveNueva2026', 'ClaveNueva2026'], mensaje: 'Ingresa tu contraseña actual.' },
    { caso: 'nueva débil', args: ['Actual1234', 'corta', 'corta'], mensaje: 'La nueva contraseña debe tener al menos 8 caracteres, con letras y números.' },
    { caso: 'no coinciden', args: ['Actual1234', 'ClaveNueva2026', 'ClaveNueva2027'], mensaje: 'Las contraseñas nuevas no coinciden.' },
  ])('$caso → «$mensaje» y no llama al servidor', async ({ args, mensaje }) => {
    const { user } = montar();
    await llenar(user, ...args);
    expect(screen.getByRole('alert')).toHaveTextContent(mensaje);
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('si el servidor dice que la actual es incorrecta, lo muestra y deja el formulario abierto', async () => {
    changePassword.mockResolvedValue({ ok: false, error: 'La contraseña actual no es correcta.' });
    const { user } = montar();
    await llenar(user, 'Incorrecta1', 'ClaveNueva2026', 'ClaveNueva2026');
    expect(await screen.findByRole('alert')).toHaveTextContent('La contraseña actual no es correcta.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('con éxito llama al contexto con { currentPassword, newPassword } y muestra la confirmación', async () => {
    changePassword.mockResolvedValue({ ok: true });
    const { user, onClose } = montar();
    await llenar(user, 'Actual1234', 'ClaveNueva2026', 'ClaveNueva2026');
    expect(changePassword).toHaveBeenCalledWith({ currentPassword: 'Actual1234', newPassword: 'ClaveNueva2026' });
    expect(await screen.findByRole('status')).toHaveTextContent('Contraseña actualizada. Cerramos tus sesiones en otros dispositivos; esta sigue abierta.');
    await user.click(screen.getByRole('button', { name: 'Listo' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape lo cierra', async () => {
    const { user, onClose } = montar();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
