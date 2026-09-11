import { Router } from 'express';
import {
  postLogin,
  postRefrescar,
  postLogout,
  postCerrarTodo,
  getYo,
} from './auth.controlador.js';
import { exigirAutenticacion } from './auth.middleware.js';

export const rutasAuth = Router();

rutasAuth.post('/login', postLogin);
rutasAuth.post('/refrescar', postRefrescar);
rutasAuth.post('/logout', postLogout);

rutasAuth.get('/yo', exigirAutenticacion, getYo);
rutasAuth.post('/cerrar-todo', exigirAutenticacion, postCerrarTodo);