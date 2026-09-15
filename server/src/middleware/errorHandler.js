export function errorHandler(err, _req, res, _next) {
  console.error(err);

  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: err.errors?.[0]?.message || 'Datos inválidos.',
      code: 'VALIDATION_ERROR',
    });
  }

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
