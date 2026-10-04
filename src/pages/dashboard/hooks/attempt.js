/* Ejecuta una acción contra la API y devuelve { ok } o { ok: false, error } para que
   los modales puedan mostrar el mensaje del servidor sin repetir el try/catch. */
export async function attempt(action) {
  try {
    await action();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
