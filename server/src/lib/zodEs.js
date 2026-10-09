/**
 * Mensajes de validación de Zod en español para TODA la API.
 * Sin esto, cualquier campo mal enviado llega al usuario como "Required" o "Invalid email".
 * Los mensajes escritos a mano en cada esquema (p. ej. el de la contraseña) tienen prioridad sobre este mapa.
 */
import { z } from 'zod';

const TIPOS = { string: 'texto', number: 'un número', integer: 'un número entero', boolean: 'sí o no', array: 'una lista', object: 'un objeto', date: 'una fecha' };

z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case 'invalid_type':
      if (issue.received === 'undefined' || issue.received === 'null') return { message: 'Falta un dato obligatorio.' };
      return { message: `Un dato tiene un tipo incorrecto (se esperaba ${TIPOS[issue.expected] || issue.expected}).` };
    case 'invalid_string':
      if (issue.validation === 'email') return { message: 'Ingresa un correo válido.' };
      if (issue.validation === 'uuid') return { message: 'El identificador no es válido.' };
      return { message: 'El formato de un dato no es válido.' };
    case 'too_small':
      if (issue.type === 'string') return { message: issue.minimum === 1 ? 'Este dato no puede estar vacío.' : `Debe tener al menos ${issue.minimum} caracteres.` };
      if (issue.type === 'number') return { message: `Debe ser ${issue.inclusive ? 'mayor o igual' : 'mayor'} a ${issue.minimum}.` };
      break;
    case 'too_big':
      if (issue.type === 'string') return { message: `Debe tener como máximo ${issue.maximum} caracteres.` };
      if (issue.type === 'number') return { message: `Debe ser ${issue.inclusive ? 'menor o igual' : 'menor'} a ${issue.maximum}.` };
      break;
    case 'invalid_enum_value':
      return { message: `Valor no permitido. Opciones: ${issue.options.join(', ')}.` };
    default:
      break;
  }
  return { message: ctx.defaultError };
});
