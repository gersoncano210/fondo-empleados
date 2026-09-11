import { Router } from 'express';
import {
  postAbrir,
  postCerrar,
  getMiCaja,
  postDepositar,
  postRetirar,
  getMovimientos,
  getHorario,
} from './caja.controlador.js';
import { exigirAutenticacion, exigirPermiso } from '../auth/auth.middleware.js';

export const rutasCaja = Router();

rutasCaja.use(exigirAutenticacion);

rutasCaja.get('/horario', getHorario);
rutasCaja.get('/mi-caja', getMiCaja);

rutasCaja.post('/abrir', exigirPermiso('caja.abrir'), postAbrir);
rutasCaja.post('/depositar', exigirPermiso('caja.depositar'), postDepositar);
rutasCaja.post('/retirar', exigirPermiso('caja.retirar'), postRetirar);

rutasCaja.get('/:id/movimientos', exigirPermiso('caja.abrir'), getMovimientos);
rutasCaja.post('/:id/cerrar', exigirPermiso('caja.cerrar'), postCerrar);