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
