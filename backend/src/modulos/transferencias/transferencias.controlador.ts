import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  transferir,
  pagoSimulado,
  pagarAporteAnual,
  movimientosDeCuenta,
} from './transferencias.servicio.js';
import { param, serializar } from '../../comun/http.js';
import { pesosACentavos } from '../../comun/dinero.js';

const montoEnPesos = z.number().positive().transform(pesosACentavos);

const esquemaTransferencia = z.object({
  cuentaOrigenId: z.string().uuid(),
  cuentaDestinoId: z.string().uuid(),
  monto: montoEnPesos,
  descripcion: z.string().max(200).optional(),
});

export async function postTransferir(req: Request, res: Response, next: NextFunction) {
  try {
    const datos = esquemaTransferencia.parse(req.body);
    const resultado = await transferir(
      datos.cuentaOrigenId,
      datos.cuentaDestinoId,
      datos.monto,
      req.usuario!,
      datos.descripcion,
    );
    res.status(201).json(serializar(resultado));
  } catch (error) {
    next(error);
  }
}

const esquemaPago = z.object({
  cuentaDestinoId: z.string().uuid(),
  monto: montoEnPesos,
  concepto: z.string().min(3).max(200),
});

export async function postPagoSimulado(req: Request, res: Response, next: NextFunction) {
  try {
    const datos = esquemaPago.parse(req.body);
    const resultado = await pagoSimulado(
      datos.cuentaDestinoId,
      datos.monto,
      req.usuario!,
      datos.concepto,
    );
    res.status(201).json(serializar(resultado));
  } catch (error) {
    next(error);
  }
}

export async function postAporteAnual(req: Request, res: Response, next: NextFunction) {
  try {
    const asociadoId = req.body?.asociadoId ?? req.usuario!.asociadoId;

    if (!asociadoId) {
      res.status(400).json({
        error: 'SIN_ASOCIADO',
        mensaje: 'No se indicó el asociado',
      });
      return;
    }

    const resultado = await pagarAporteAnual(asociadoId, req.usuario!);
    res.status(201).json(serializar(resultado));
  } catch (error) {
    next(error);
  }
}

export async function getMovimientos(req: Request, res: Response, next: NextFunction) {
  try {
    const limite = req.query.limite ? Number(req.query.limite) : 50;
    const movimientos = await movimientosDeCuenta(
      param(req, 'cuentaId'),
      req.usuario!,
      limite,
    );
    res.json(serializar(movimientos));
  } catch (error) {
    next(error);
  }
}