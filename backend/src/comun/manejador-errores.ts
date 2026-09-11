import type { Request, Response, NextFunction } from 'express';
import { ErrorNegocio } from './errores.js';

export function manejadorDeErrores(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof ErrorNegocio) {
    res.status(error.estadoHttp).json({
      error: error.codigo,
      mensaje: error.message,
    });
    return;
  }

  console.error('Error no controlado:', error);

  res.status(500).json({
    error: 'ERROR_INTERNO',
    mensaje: 'Ocurrió un error inesperado',
  });
}