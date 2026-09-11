import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  vincularAsociado,
  listarAsociados,
  obtenerAsociado,
  historialSalarios,
  registrarSalario,
  desafiliarAsociado,
  cambiarEstadoCuenta,
  calcularAporteAnual,
} from './asociados.servicio.js';
import { verificarEsPropio } from '../../comun/alcance.js';
import { pesosACentavos } from '../../comun/dinero.js';
import { param, serializar } from '../../comun/http.js';


/** Los montos llegan en pesos desde el cliente y se convierten a centavos aquí */
const montoEnPesos = z.number().positive().transform(pesosACentavos);

const esquemaVinculacion = z.object({
  tipoDocumento: z.enum(['CC', 'CE', 'PASAPORTE']),
  numeroDocumento: z.string().min(5).max(20),
  nombres: z.string().min(2).max(100),
  apellidos: z.string().min(2).max(100),
  fechaNacimiento: z.coerce.date().optional(),
  direccion: z.string().max(200).optional(),
  telefono: z.string().max(20).optional(),
  correoPersonal: z.string().email().optional(),
  contactoEmergenciaNombre: z.string().max(100).optional(),
  contactoEmergenciaTelefono: z.string().max(20).optional(),

  cargoEmpresa: z.string().min(2).max(100),
  salarioMensual: montoEnPesos,

  sucursalId: z.string().uuid(),
  asesorAsignadoId: z.string().uuid().optional(),

  correoAcceso: z.string().email(),
  contrasenaInicial: z.string().min(8, 'Mínimo 8 caracteres'),

  cajaId: z.string().uuid(),
  pagaAporteInicial: z.boolean().default(true),
});

export async function postVincular(req: Request, res: Response, next: NextFunction) {
  try {
    const datos = esquemaVinculacion.parse(req.body);
    const resultado = await vincularAsociado(datos, req.usuario!);
    res.status(201).json(serializar(resultado));
  } catch (error) {
    next(error);
  }
}

export async function getListar(req: Request, res: Response, next: NextFunction) {
  try {
    const busqueda = req.query.busqueda as string | undefined;
    const estado = req.query.estado as 'ACTIVO' | 'RETIRADO' | undefined;
    const pagina = req.query.pagina ? Number(req.query.pagina) : 1;

    const resultado = await listarAsociados(req.usuario!, { busqueda, estado, pagina });
    res.json(serializar(resultado));
  } catch (error) {
    next(error);
  }
}

export async function getDetalle(req: Request, res: Response, next: NextFunction) {
  try {
    verificarEsPropio(req.usuario!, param(req, 'id'));
    const asociado = await obtenerAsociado(param(req, 'id'), req.usuario!);
    res.json(serializar(asociado));
  } catch (error) {
    next(error);
  }
}

export async function getMiPerfil(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.usuario!.asociadoId) {
      res.status(404).json({ error: 'NO_ES_ASOCIADO', mensaje: 'No está afiliado al fondo' });
      return;
    }
    const asociado = await obtenerAsociado(req.usuario!.asociadoId, req.usuario!);
    res.json(serializar(asociado));
  } catch (error) {
    next(error);
  }
}

export async function getHistorialSalarios(req: Request, res: Response, next: NextFunction) {
  try {
    const historial = await historialSalarios(param(req, 'id'), req.usuario!);
    res.json(serializar(historial));
  } catch (error) {
    next(error);
  }
}

const esquemaSalario = z.object({
  valor: montoEnPesos,
  soporte: z.string().min(5).max(200),
});

export async function postSalario(req: Request, res: Response, next: NextFunction) {
  try {
    const { valor, soporte } = esquemaSalario.parse(req.body);
    const registro = await registrarSalario(param(req, 'id'), valor, soporte, req.usuario!);
    res.status(201).json(serializar(registro));
  } catch (error) {
    next(error);
  }
}

const esquemaDesafiliacion = z.object({ cajaId: z.string().uuid() });

export async function postDesafiliar(req: Request, res: Response, next: NextFunction) {
  try {
    const { cajaId } = esquemaDesafiliacion.parse(req.body);
    const resultado = await desafiliarAsociado(param(req, 'id'), cajaId, req.usuario!);
    res.json(serializar(resultado));
  } catch (error) {
    next(error);
  }
}

const esquemaEstadoCuenta = z.object({ estado: z.enum(['ACTIVA', 'BLOQUEADA']) });

export async function patchEstadoCuenta(req: Request, res: Response, next: NextFunction) {
  try {
    const { estado } = esquemaEstadoCuenta.parse(req.body);
    const cuenta = await cambiarEstadoCuenta(param(req, 'cuentaId'), estado, req.usuario!);
    res.json(serializar(cuenta));
  } catch (error) {
    next(error);
  }
}

const esquemaSimulacionAporte = z.object({ salarioMensual: montoEnPesos });

export async function postSimularAporte(req: Request, res: Response, next: NextFunction) {
  try {
    const { salarioMensual } = esquemaSimulacionAporte.parse(req.body);
    const aporte = await calcularAporteAnual(salarioMensual);
    res.json(serializar({ salarioMensual, aporteAnual: aporte }));
  } catch (error) {
    next(error);
  }
}

