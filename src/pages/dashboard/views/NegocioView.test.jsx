/**
 * Vista «Mi negocio» (solo dueño, U3): muestra el perfil, valida antes de enviar y guarda con onSave.
 * Sin API: onSave es simulado.
 */
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NegocioView } from './NegocioView';

const negocio = {
  id: 'n1', name: 'Barbería La Navaja', logo: null, phone: '3001234567', address: 'Calle 10 # 5-20', description: 'Cortes clásicos',
};

// Igual que en la app: el negocio guardado vuelve por el contexto y la vista lo recibe como prop.
function Contenedor({ onSave }) {
  const [business, setBusiness] = useState(negocio);
  const guardar = async (patch) => {
    const result = await onSave(patch);
    if (result.ok) setBusiness(result.business);
    return result;
  };
  return <NegocioView business={business} onSave={guardar} />;
}

const montar = (over = {}) => {
  const onSave = over.onSave || vi.fn().mockImplementation(async (patch) => ({ ok: true, business: { ...negocio, ...patch, logo: patch.logoUrl } }));
  render(<Contenedor onSave={onSave} />);
  return { user: userEvent.setup(), onSave };
};

const campo = (nombre) => screen.getByRole('textbox', { name: nombre });

describe('Mi negocio', () => {
  it('muestra los datos actuales en campos con nombre accesible', () => {
    montar();
    expect(campo('Nombre del negocio')).toHaveValue('Barbería La Navaja');
    expect(campo('Teléfono')).toHaveValue('3001234567');
    expect(campo('Dirección')).toHaveValue('Calle 10 # 5-20');
    expect(campo('Descripción')).toHaveValue('Cortes clásicos');
    expect(screen.getByLabelText(/Logo/)).toHaveValue('');
  });

  it('«Guardar cambios» está desactivado hasta que se modifica algo', async () => {
    const { user } = montar();
    const boton = screen.getByRole('button', { name: 'Guardar cambios' });
    expect(boton).toBeDisabled();
    await user.type(campo('Dirección'), ' B');
    expect(boton).toBeEnabled();
  });

  it('guarda los cambios, confirma y vuelve a deshabilitar el botón', async () => {
    const { user, onSave } = montar();
    await user.clear(campo('Nombre del negocio'));
    await user.type(campo('Nombre del negocio'), 'El Fade');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'El Fade', logoUrl: null }));
    expect(await screen.findByRole('status')).toHaveTextContent('Cambios guardados.');
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
  });

  it.each([
    ['nombre vacío', 'Nombre del negocio', '', /Ingresa el nombre del negocio/],
    ['teléfono con letras', 'Teléfono', 'llámame', /El teléfono solo puede tener/],
    ['teléfono demasiado corto', 'Teléfono', '123', /El teléfono solo puede tener/],
  ])('%s: avisa y no llama al servidor', async (_n, etiqueta, valor, mensaje) => {
    const { user, onSave } = montar();
    await user.clear(campo(etiqueta));
    if (valor) await user.type(campo(etiqueta), valor);
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);
    expect(onSave).not.toHaveBeenCalled();
  });

  it.each(['javascript:alert(1)', 'data:text/html,hola', 'ftp://x.com/a.png', 'no es una dirección'])(
    'el logo «%s» se rechaza en el cliente',
    async (logo) => {
      const { user, onSave } = montar();
      await user.type(screen.getByLabelText(/Logo/), logo);
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(/dirección web válida/);
      expect(onSave).not.toHaveBeenCalled();
    },
  );

  it('un logo https válido se envía recortado y muestra la vista previa', async () => {
    const { user, onSave } = montar();
    await user.type(screen.getByLabelText(/Logo/), '  https://cdn.ejemplo.com/logo.png  ');
    expect(screen.getByAltText('Vista previa del logo')).toHaveAttribute('src', 'https://cdn.ejemplo.com/logo.png');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ logoUrl: 'https://cdn.ejemplo.com/logo.png' }));
  });

  it('nunca pinta una vista previa con un esquema peligroso', async () => {
    const { user } = montar();
    await user.type(screen.getByLabelText(/Logo/), 'javascript:alert(1)');
    expect(screen.queryByAltText('Vista previa del logo')).toBeNull();
  });

  it('muestra el error que devuelva el servidor y conserva lo escrito', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: false, error: 'El nombre del negocio es demasiado largo (máximo 80 caracteres).' });
    const { user } = montar({ onSave });
    await user.type(campo('Dirección'), ' B');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/demasiado largo/);
    expect(campo('Dirección')).toHaveValue('Calle 10 # 5-20 B');
  });
});
