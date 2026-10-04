import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import businessRoutes from './routes/businesses.js';
import clientRoutes from './routes/clients.js';
import serviceRoutes from './routes/services.js';
import productRoutes from './routes/products.js';
import appointmentRoutes from './routes/appointments.js';
import productSaleRoutes from './routes/productSales.js';
import analyticsRoutes from './routes/analytics.js';
import masterRoutes from './routes/master.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // Detrás de un proxy (nginx, balanceador) hay que confiar en él para ver la IP real del cliente;
  // si no, el límite de peticiones se aplicaría a todos los usuarios juntos. TRUST_PROXY = nº de proxies.
  const proxyHops = Number(process.env.TRUST_PROXY);
  if (proxyHops > 0) app.set('trust proxy', proxyHops);

  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  app.use(helmet());
  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: Number(process.env.RATE_LIMIT_MAX) || 1000,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 100,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'barberflow-api' });
  });

  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok', service: 'barberflow-api', version: '1' });
  });

  app.use('/api/v1/auth', authLimiter, authRoutes);
  app.use('/api/v1/businesses', businessRoutes);
  app.use('/api/v1/clients', clientRoutes);
  app.use('/api/v1/services', serviceRoutes);
  app.use('/api/v1/products', productRoutes);
  app.use('/api/v1/appointments', appointmentRoutes);
  app.use('/api/v1/product-sales', productSaleRoutes);
  app.use('/api/v1/analytics', analyticsRoutes);
  app.use('/api/v1/master', masterRoutes);

  app.use(errorHandler);

  return app;
}
