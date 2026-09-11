import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { abrirCaja, cerrarCaja, miCajaAbierta } from './caja.servicio.js';
import { param, serializar } from '../../comun/http.js';
import { pesosACentavos } from '../../comun/dinero.js';

const montoEnPesos = z.number().nonnegative().transform(pesosACentavos);

const esquemaApertura = z.object({ saldoInicial: montoEnPesos.default(0 as any) });

export async function postAbrir(req: Request, res: Response, next: NextFunction) {
  try {
    const { saldoInicial } = esquemaApertura.parse(req.body ?? {});
    const caja = await abrirCaja(req.usuario!, saldoInicial);
    res.status(201).json(serializar(caja));
  } catch (error) {
    next(error);
  }
}

const esquemaCierre = z.object({ saldoContado: montoEnPesos });

export async function postCerrar(req: Request, res: Response, next: NextFunction) {
  try {
    const { saldoContado } = esquemaCierre.parse(req.body);
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