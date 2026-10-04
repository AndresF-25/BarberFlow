import { describe, expect, it } from 'vitest';
import {
  addDays, amountToCents, appointmentStatusFromUi, appointmentStatusToUi, businessDateOf, centsToAmount,
  endOfMonth, endOfWeek, nowInBusinessTz, parseDateOnly, publicBusiness, publicUser, startOfMonth, startOfWeek,
  timeToMinutes,
} from '../../src/lib/utils.js';

describe('fechas', () => {
  it('parseDateOnly acepta fechas válidas y devuelve medianoche UTC', () => {
    expect(parseDateOnly('2026-02-28').toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });

  it.each(['2026-02-31', '2026-13-01', 'abc', '2026-2-3', ''])('parseDateOnly rechaza "%s" con error 400', (valor) => {
    expect(() => parseDateOnly(valor)).toThrow(expect.objectContaining({ status: 400, code: 'INVALID_DATE' }));
  });

  it('timeToMinutes convierte HH:MM', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('09:30')).toBe(570);
    expect(timeToMinutes('23:59')).toBe(1439);
  });

  it('businessDateOf usa la zona horaria del negocio (Bogotá, UTC-5)', () => {
    expect(businessDateOf(new Date('2026-01-02T03:00:00Z'))).toBe('2026-01-01'); // 22:00 del día anterior en Bogotá
    expect(businessDateOf(new Date('2026-01-02T05:00:00Z'))).toBe('2026-01-02');
  });

  it('nowInBusinessTz devuelve fecha y hora con formato fijo', () => {
    const { date, time } = nowInBusinessTz();
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(time).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
  });

  it('addDays cruza meses y años', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('la semana empieza el lunes y termina el domingo', () => {
    // 2026-10-04 es domingo
    expect(startOfWeek('2026-10-04')).toBe('2026-09-28');
    expect(endOfWeek('2026-10-04')).toBe('2026-10-04');
    expect(startOfWeek('2026-09-28')).toBe('2026-09-28');
    expect(endOfWeek('2026-09-28')).toBe('2026-10-04');
  });

  it('inicio y fin de mes, incluido febrero bisiesto', () => {
    expect(startOfMonth('2026-10-17')).toBe('2026-10-01');
    expect(endOfMonth('2026-10-17')).toBe('2026-10-31');
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
  });
});

describe('dinero y estados', () => {
  it('convierte entre pesos y centavos', () => {
    expect(amountToCents(28000)).toBe(2800000);
    expect(amountToCents('150.5')).toBe(15050);
    expect(centsToAmount(2800000)).toBe(28000);
  });

  it('traduce estados de cita entre API y UI en ambos sentidos', () => {
    expect(appointmentStatusToUi('completed')).toBe('Finalizada');
    expect(appointmentStatusFromUi('Cancelada')).toBe('cancelled');
    expect(appointmentStatusFromUi('pending')).toBe('pending'); // ya está en formato API
  });
});

describe('respuestas públicas', () => {
  it('publicUser nunca expone el hash de la contraseña', () => {
    const user = publicUser({ id: '1', name: 'Ana', email: 'a@x.com', role: 'owner', businessId: 'b', passwordHash: 'SECRETO' });
    expect(user).toEqual({ id: '1', name: 'Ana', email: 'a@x.com', role: 'owner', businessId: 'b' });
    expect(JSON.stringify(user)).not.toContain('SECRETO');
  });

  it('publicUser y publicBusiness toleran null', () => {
    expect(publicUser(null)).toBeNull();
    expect(publicBusiness(null)).toBeNull();
  });
});
