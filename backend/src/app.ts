import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rutasAuth } from './modulos/auth/auth.rutas.js';
import { manejadorDeErrores } from './comun/manejador-errores.js';
import { rutasAsociados } from './modulos/asociados/asociados.rutas.js';
import { rutasCaja } from './modulos/caja/caja.rutas.js';
import { rutasTransferencias } from './modulos/transferencias/transferencias.rutas.js';

export const crearApp = () => {
  const app = express();

  app.use(
    cors({
      origin: ['http://localhost:4200', 'http://localhost:4300'],
      credentials: true, // permite enviar cookies
    }),
  );
  app.use(express.json());
  app.use(cookieParser());
  

  app.get('/api/salud', (_req, res) => {
    res.json({
      estado: 'ok',
      servicio: 'fondo-empleados-api',
      fecha: new Date().toISOString(),
    });
  });

  app.use('/api/auth', rutasAuth);
  app.use('/api/asociados', rutasAsociados);
  app.use('/api/caja', rutasCaja);
  app.use('/api/transferencias', rutasTransferencias);
  
  // Debe ir al final, después de todas las rutas
  app.use(manejadorDeErrores);

  return app;
};