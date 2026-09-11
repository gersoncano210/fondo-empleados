import type { Request, Response, NextFunction } from 'express';
import { verificarTokenAcceso } from './tokens.servicio.js';
import { obtenerPermisosDeUsuario } from './auth.servicio.js';
import { prisma } from '../../comun/prisma.js';
import { ErrorNegocio } from '../../comun/errores.js';

/** Datos del usuario autenticado, disponibles en toda la petición */
export interface UsuarioAutenticado {
  id: string;
  personaId: string;
  permisos: string[];
  roles: string[];
  sucursalId: string | null;
  esAdministrador: boolean;
  asociadoId: string | null;
  empleadoId: string | null;
}

// Le enseña a TypeScript que req.usuario existe
declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioAutenticado;
    }
  }
}

/** Exige un token de acceso válido */
export async function exigirAutenticacion(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.cookies?.token_acceso;

    if (!token) {
      throw new ErrorNegocio('No autenticado', 'NO_AUTENTICADO', 401);
    }

    const contenido = verificarTokenAcceso(token);

    const usuario = await prisma.usuario.findUnique({
      where: { id: contenido.usuarioId },
      include: {
        persona: {
          include: {
            empleado: { select: { id: true, sucursalId: true, estado: true } },
            asociado: { select: { id: true, sucursalId: true, estado: true } },
          },
        },
        roles: { include: { rol: true } },
      },
    });

    if (!usuario || usuario.estado !== 'ACTIVO') {
      throw new ErrorNegocio('Sesión inválida', 'SESION_INVALIDA', 401);
    }

    const roles = usuario.roles.map((ur) => ur.rol.nombre);

    req.usuario = {
      id: usuario.id,
      personaId: usuario.personaId,
      permisos: await obtenerPermisosDeUsuario(usuario.id),
      roles,
      sucursalId:
        usuario.persona.empleado?.sucursalId ??
        usuario.persona.asociado?.sucursalId ??
        null,
      esAdministrador: roles.includes('ADMINISTRADOR') || roles.includes('REVISOR_FISCAL'),
      asociadoId: usuario.persona.asociado?.id ?? null,
      empleadoId: usuario.persona.empleado?.id ?? null,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Exige uno o varios permisos.
 * Uso: router.post('/', exigirPermiso('asociado.crear'), controlador)
 */
export function exigirPermiso(...requeridos: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.usuario) {
      return next(new ErrorNegocio('No autenticado', 'NO_AUTENTICADO', 401));
    }

    const tiene = requeridos.every((p) => req.usuario!.permisos.includes(p));

    if (!tiene) {
      return next(
        new ErrorNegocio(
          `Permiso insuficiente. Se requiere: ${requeridos.join(', ')}`,
          'PERMISO_INSUFICIENTE',
          403,
        ),
      );
    }

    next();
  };
}

/** Exige al menos uno de los permisos indicados */
export function exigirAlgunPermiso(...opciones: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.usuario) {
      return next(new ErrorNegocio('No autenticado', 'NO_AUTENTICADO', 401));
    }

    const tiene = opciones.some((p) => req.usuario!.permisos.includes(p));

    if (!tiene) {
      return next(
        new ErrorNegocio('Permiso insuficiente', 'PERMISO_INSUFICIENTE', 403),
      );
    }

    next();
  };
}