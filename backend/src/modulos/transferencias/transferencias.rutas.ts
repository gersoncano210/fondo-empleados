import { Router } from 'express';
import {
  postTransferir,
  postPagoSimulado,
  postAporteAnual,
  getMovimientos,
} from './transferencias.controlador.js';
import { exigirAutenticacion, exigirPermiso } from '../auth/auth.middleware.js';

export const rutasTransferencias = Router();

rutasTransferencias.use(exigirAutenticacion);

rutasTransferencias.post('/', exigirPermiso('cuenta.transferir'), postTransferir);
rutasTransferencias.post('/pago-simulado', postPagoSimulado);
rutasTransferencias.post('/aporte-anual', postAporteAnual);

rutasTransferencias.get(
  '/cuentas/:cuentaId/movimientos',
  exigirPermiso('cuenta.consultar'),
  getMovimientos,
);