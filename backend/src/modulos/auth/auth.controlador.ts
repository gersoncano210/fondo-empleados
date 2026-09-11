import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  iniciarSesion,
  refrescarSesion,
  obtenerPermisosDeUsuario,
} from './auth.servicio.js';
import { revocarTokenRefresco, revocarTodosLosTokens } from './tokens.servicio.js';
import { prisma } from '../../comun/prisma.js';

const esquemaLogin = z.object({
  correo: z.string().email('Correo inválido'),
  contrasena: z.string().min(1, 'La contraseña es obligatoria'),
});

const MINUTOS_ACCESO = Number(process.env.JWT_MINUTOS_ACCESO ?? 15);
const DIAS_REFRESCO = Number(process.env.JWT_DIAS_REFRESCO ?? 7);
const enProduccion = process.env.NODE_ENV === 'production';

/** Opciones comunes de las cookies de sesión */
function opcionesCookie(maxAgeMs: number) {
  return {
    httpOnly: true,          // JavaScript no puede leerla
    secure: enProduccion,    // solo por HTTPS en producción
    sameSite: 'lax' as const, // protege contra CSRF
    path: '/',
    maxAge: maxAgeMs,
  };
}

export async function postLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const { correo, contrasena } = esquemaLogin.parse(req.body);

    const resultado = await iniciarSesion(correo, contrasena, req.ip);

    res.cookie(
      'token_acceso',
      resultado.tokenAcceso,
      opcionesCookie(MINUTOS_ACCESO * 60 * 1000),
    );
    res.cookie(
      'token_refresco',
      resultado.tokenRefresco,
      opcionesCookie(DIAS_REFRESCO * 24 * 60 * 60 * 1000),
    );

    // El token nunca viaja en el cuerpo: solo en la cookie
    res.json({ usuario: resultado.usuario });
  } catch (error) {
    next(error);
  }
}

export async function postRefrescar(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.token_refresco;

    if (!token) {
      res.status(401).json({ error: 'NO_AUTENTICADO', mensaje: 'Sin token de refresco' });
      return;
    }

    const resultado = await refrescarSesion(token, req.ip);

    res.cookie(
      'token_acceso',
      resultado.tokenAcceso,
      opcionesCookie(MINUTOS_ACCESO * 60 * 1000),
    );
    res.cookie(
      'token_refresco',
      resultado.tokenRefresco,
      opcionesCookie(DIAS_REFRESCO * 24 * 60 * 60 * 1000),
    );

    res.json({ ok: true });
  } catch (error) {
    res.clearCookie('token_acceso');
    res.clearCookie('token_refresco');
    next(error);
  }
}

export async function postLogout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.token_refresco;
    if (token) {
      await revocarTokenRefresco(token);
    }

    res.clearCookie('token_acceso');
    res.clearCookie('token_refresco');
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function postCerrarTodo(req: Request, res: Response, next: NextFunction) {
  try {
    await revocarTodosLosTokens(req.usuario!.id);
    res.clearCookie('token_acceso');
    res.clearCookie('token_refresco');
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

/** Datos del usuario actual, para que el frontend sepa qué mostrar */
export async function getYo(req: Request, res: Response, next: NextFunction) {
  try {
    const usuario = await prisma.usuario.findUniqueOrThrow({
      where: { id: req.usuario!.id },
      include: {
        persona: {
          select: { nombres: true, apellidos: true, numeroDocumento: true },
        },
      },
    });

    res.json({
      id: usuario.id,
      correoAcceso: usuario.correoAcceso,
      nombres: usuario.persona.nombres,
      apellidos: usuario.persona.apellidos,
      roles: req.usuario!.roles,
      permisos: await obtenerPermisosDeUsuario(usuario.id),
      sucursalId: req.usuario!.sucursalId,
      esAsociado: req.usuario!.asociadoId !== null,
      esEmpleado: req.usuario!.empleadoId !== null,
    });
  } catch (error) {
    next(error);
  }
}