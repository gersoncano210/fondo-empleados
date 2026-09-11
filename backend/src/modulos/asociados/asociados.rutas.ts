import { Router } from 'express';
import {
  postVincular,
  getListar,
  getDetalle,
  getMiPerfil,
  getHistorialSalarios,
  postSalario,
  postDesafiliar,
  patchEstadoCuenta,
  postSimularAporte,
} from './asociados.controlador.js';
import { exigirAutenticacion, exigirPermiso } from '../auth/auth.middleware.js';

export const rutasAsociados = Router();

rutasAsociados.use(exigirAutenticacion);

// El asociado consulta lo suyo
rutasAsociados.get('/mi-perfil', getMiPerfil);

// Operaciones de empleados
rutasAsociados.post('/', exigirPermiso('asociado.crear'), postVincular);
rutasAsociados.get('/', exigirPermiso('asociado.consultar'), getListar);
rutasAsociados.post('/simular-aporte', exigirPermiso('asociado.crear'), postSimularAporte);

rutasAsociados.get('/:id', getDetalle);
rutasAsociados.get('/:id/salarios', exigirPermiso('asociado.consultar'), getHistorialSalarios);
rutasAsociados.post('/:id/salarios', exigirPermiso('salario.registrar'), postSalario);
rutasAsociados.post('/:id/desafiliar', exigirPermiso('asociado.desafiliar'), postDesafiliar);

rutasAsociados.patch('/cuentas/:cuentaId/estado', exigirPermiso('cuenta.bloquear'), patchEstadoCuenta);