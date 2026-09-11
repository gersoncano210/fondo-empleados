import { Router } from 'express';
import { postAbrir, postCerrar, getMiCaja } from './caja.controlador.js';
import { exigirAutenticacion, exigirPermiso } from '../auth/auth.middleware.js';

export const rutasCaja = Router();

rutasCaja.use(exigirAutenticacion);

rutasCaja.get('/mi-caja', getMiCaja);
rutasCaja.post('/abrir', exigirPermiso('caja.abrir'), postAbrir);
rutasCaja.post('/:id/cerrar', exigirPermiso('caja.cerrar'), postCerrar);