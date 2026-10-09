/* =========================================================================
   FECHAS (YYYY-MM-DD) y carga de citas
   ========================================================================= */
export const isoToUtc = (iso) => new Date(`${iso}T00:00:00Z`);

const utcToIso = (d) => d.toISOString().slice(0, 10);

export const addDaysIso = (iso, n) => { const d = isoToUtc(iso); d.setUTCDate(d.getUTCDate() + n); return utcToIso(d); };

export const startOfWeekIso = (iso) => { const day = isoToUtc(iso).getUTCDay(); return addDaysIso(iso, day === 0 ? -6 : 1 - day); };

export const startOfMonthIso = (iso) => `${iso.slice(0, 7)}-01`;

export const endOfMonthIso = (iso) => { const d = isoToUtc(startOfMonthIso(iso)); d.setUTCMonth(d.getUTCMonth() + 1, 0); return utcToIso(d); };

export const addMonthsIso = (iso, n) => { const d = isoToUtc(startOfMonthIso(iso)); d.setUTCMonth(d.getUTCMonth() + n); return utcToIso(d); };

export const fmtFechaLarga = (iso) => isoToUtc(iso).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

export const fmtFechaCorta = (iso) => isoToUtc(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'UTC' });

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «7 oct 2026» (siempre igual, sin depender del navegador); si no hay fecha (— o vacío) devuelve «—». */
export const fmtFecha = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${Number(m[3])} ${MESES_CORTOS[Number(m[2]) - 1]} ${m[1]}` : '—';
};

/** «Jueves, 8 de octubre»: primera letra en mayúscula, el resto como lo escribe el idioma. */
export const capitalizar = (texto) => (texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto);

/** «5 al 11 de octubre» o, si cruza de mes, «28 de septiembre al 4 de octubre». */
export const fmtRangoSemana = (inicioIso, finIso) => {
  const [a, b] = [isoToUtc(inicioIso), isoToUtc(finIso)];
  const mes = (d) => d.toLocaleDateString('es-CO', { month: 'long', timeZone: 'UTC' });
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()} al ${b.getUTCDate()} de ${mes(b)}`
    : `${a.getUTCDate()} de ${mes(a)} al ${b.getUTCDate()} de ${mes(b)}`;
};
