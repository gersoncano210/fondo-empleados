import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  abrirCaja,
  cerrarCaja,
  miCajaAbierta,
  depositar,
  retirar,
  movimientosDeCaja,
} from './caja.servicio.js';
import { estadoVentanilla } from '../../comun/horario.js';
import { param, serializar } from '../../comun/http.js';
import { pesosACentavos } from '../../comun/dinero.js';

const montoEnPesos = z.number().positive().transform(pesosACentavos);
const montoNoNegativo = z.number().nonnegative().transform(pesosACentavos);

export async function postAbrir(req: Request, res: Response, next: NextFunction) {
  try {
    const esquema = z.object({ saldoInicial: montoNoNegativo.optional() });
    const { saldoInicial } = esquema.parse(req.body ?? {});
    const caja = await abrirCaja(req.usuario!, saldoInicial ?? 0n);
    res.status(201).json(serializar(caja));
  } catch (error) {
    next(error);
  }
}

export async function postCerrar(req: Request, res: Response, next: NextFunction) {
  try {
    const esquema = z.object({ saldoContado: montoNoNegativo });
    const { saldoContado } = esquema.parse(req.body);
    const caja = await cerrarCaja(param(req, 'id'), saldoContado, req.usuario!);
    res.json(serializar(caja));
  } catch (error) {
    next(error);
  }
}

export async function getMiCaja(req: Request, res: Response, next: NextFunction) {
  try {
    const caja = await miCajaAbierta(req.usuario!);
    res.json(serializar(caja));
  } catch (error) {
    next(error);
  }
}

const esquemaDeposito = z.object({
  cuentaId: z.string().uuid(),
  monto: montoEnPesos,
  referencia: z.string().max(80).optional(),
});

export async function postDepositar(req: Request, res: Response, next: NextFunction) {
  try {
    const { cuentaId, monto, referencia } = esquemaDeposito.parse(req.body);
    const resultado = await depositar(cuentaId, monto, req.usuario!, referencia);
    res.status(201).json(serializar(resultado));
  } catch (error) {
    next(error);
  }
}

const esquemaRetiro = z.object({
  cuentaId: z.string().uuid(),
  monto: montoEnPesos,
  autorizadoPorId: z.string().uuid().optional(),
  referencia: z.string().max(80).optional(),
});

export async function postRetirar(req: Request, res: Response, next: NextFunction) {
  try {
    const datos = esquemaRetiro.parse(req.body);
    const resultado = await retirar(datos.cuentaId, datos.monto, req.usuario!, {
      autorizadoPorId: datos.autorizadoPorId,
      referencia: datos.referencia,
    });
    res.status(201).json(serializar(resultado));
  } catch (error) {
    next(error);
  }
}

export async function getMovimientos(req: Request, res: Response, next: NextFunction) {
  try {
    const movimientos = await movimientosDeCaja(param(req, 'id'), req.usuario!);
    res.json(serializar(movimientos));
  } catch (error) {
    next(error);
  }
}

export async function getHorario(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await estadoVentanilla());
  } catch (error) {
    next(error);
  }
}