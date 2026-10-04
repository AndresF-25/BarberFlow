export function errorHandler(err, _req, res, _next) {
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: err.errors?.[0]?.message || 'Datos inválidos.',
      code: 'VALIDATION_ERROR',
    });
  }

  // Los errores con `status` (4xx) son respuestas esperadas de la API: no se registran en el log.
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }

  console.error(err);

  if (err.status) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }

  return res.status(500).json({ error: 'Error interno del servidor.', code: 'INTERNAL_ERROR' });
}

export function createError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}
