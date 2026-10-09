/**
 * Modal y Field: la accesibilidad común a los 9 modales y al cajón lateral del panel (hallazgo U1).
 * Antes: sin role="dialog", sin nombre accesible en los campos, Escape no cerraba y el foco se escapaba.
 */
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal, Field } from './Modal';

function Escena({ onClose = () => {}, ...props }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div>
      <button onClick={() => setAbierto(true)}>Abrir</button>
      {abierto && (
        <Modal title="Nuevo cliente" onClose={() => { onClose(); setAbierto(false); }} {...props}>
          <Field label="Nombre"><input /></Field>
          <Field label="Correo"><input type="email" /></Field>
          <button>Guardar</button>
        </Modal>
      )}
    </div>
  );
}

const abrir = async () => {
  const user = userEvent.setup();
  render(<Escena showClose />);
  await user.click(screen.getByRole('button', { name: 'Abrir' }));
  return user;
};

describe('Modal · semántica', () => {
  it('es un diálogo modal con nombre accesible (su título)', async () => {
    await abrir();
    const d = screen.getByRole('dialog', { name: 'Nuevo cliente' });
    expect(d).toHaveAttribute('aria-modal', 'true');
  });

  it('el botón de cerrar tiene nombre accesible', async () => {
    await abrir();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
  });

  it('conserva las clases que usan las demás pruebas: max-w-md por defecto, max-w-sm si es pequeño', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Escena />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(screen.getByRole('dialog').className).toMatch(/max-w-md/);
    unmount();
    render(<Escena size="sm" />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(screen.getByRole('dialog').className).toMatch(/max-w-sm/);
  });

  it('el cajón lateral usa el contenedor .fixed.inset-0.z-50.flex.justify-end', async () => {
    const user = userEvent.setup();
    render(<Escena side />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(document.querySelector('.fixed.inset-0.z-50.flex.justify-end')).toBeTruthy();
  });
});

describe('Field · etiquetas enlazadas', () => {
  it('cada campo se encuentra por su etiqueta (antes los campos no tenían nombre)', async () => {
    await abrir();
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo')).toHaveAttribute('type', 'email');
    expect(screen.getByRole('textbox', { name: 'Nombre' })).toBeInTheDocument();
  });

  it('cada Field genera un id distinto (dos modales no se pisan)', async () => {
    await abrir();
    expect(screen.getByLabelText('Nombre').id).not.toBe(screen.getByLabelText('Correo').id);
  });
});

describe('Modal · cierre', () => {
  it('Escape lo cierra', async () => {
    const user = await abrir();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hacer clic en el fondo lo cierra; hacer clic dentro no', async () => {
    const user = await abrir();
    await user.click(screen.getByLabelText('Nombre'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('dialog').parentElement);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('llama a onClose una sola vez con Escape', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Escena onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Modal · foco', () => {
  it('al abrirse, el foco entra al primer campo', async () => {
    await abrir();
    expect(screen.getByLabelText('Nombre')).toHaveFocus();
  });

  it('Tab recorre el diálogo y vuelve al principio sin salir de él', async () => {
    const user = await abrir();
    // Nombre → Correo → Guardar → Cerrar → (vuelve) Nombre
    await user.tab();
    expect(screen.getByLabelText('Correo')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    expect(screen.getByLabelText('Nombre')).toHaveFocus();
  });

  it('Mayús+Tab desde el primer campo va al último elemento del diálogo', async () => {
    const user = await abrir();
    await user.tab({ shift: true });
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(screen.getByLabelText('Nombre'));
  });

  it('al cerrarse, el foco vuelve al botón que lo abrió', async () => {
    const user = await abrir();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus();
  });

  it('mientras está abierto bloquea el desplazamiento de la página y lo restaura al cerrar', async () => {
    const user = await abrir();
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});

describe('capa (U11)', () => {
  it('el diálogo se dibuja en el <body>, no dentro de la vista: así la cabecera fija no lo tapa', async () => {
    const user = userEvent.setup();
    const { container } = render(<Escena showClose />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    const dialogo = screen.getByRole('dialog');
    expect(container.contains(dialogo)).toBe(false);
    expect(document.body.contains(dialogo)).toBe(true);
    expect(dialogo.closest('.fixed.inset-0.z-50')?.parentElement).toBe(document.body);
  });

  it('al cerrarlo desaparece del <body>', async () => {
    const user = userEvent.setup();
    render(<Escena showClose />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    await user.keyboard('{Escape}');
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });
});
