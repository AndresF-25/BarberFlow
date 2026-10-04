import 'dotenv/config';

// Valores fijos para que los tests no dependan de la configuración local.
process.env.BUSINESS_TZ = 'America/Bogota';
process.env.AUTH_RATE_LIMIT_MAX = '100000';
process.env.RATE_LIMIT_MAX = '100000';
process.env.NODE_ENV = 'test';
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  process.env.JWT_SECRET = 'secreto-solo-para-tests-0123456789';
}
