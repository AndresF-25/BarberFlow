/* Ejecuta una acción contra la API y devuelve { ok } o { ok: false, error } para que
   los modales puedan mostrar el mensaje del servidor sin repetir el try/catch.
   Si la acción devuelve un objeto, se añade al resultado (p. ej. avisos del servidor). */
export async function attempt(action) {
  try {
    const extra = await action();
    return { ...(extra && typeof extra === 'object' && !Array.isArray(extra) ? extra : {}), ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
