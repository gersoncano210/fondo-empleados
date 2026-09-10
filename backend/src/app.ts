import express from 'express';
import cors from 'cors';

export const crearApp = () => {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  app.get('/api/salud', (_req, res) => {
    res.json({
      estado: 'ok',
      servicio: 'fondo-empleados-api',
      fecha: new Date().toISOString(),
    });
  });

  return app;
};