import type { UsuarioAutenticado } from '../modulos/auth/auth.middleware.js';
import { ErrorNegocio } from './errores.js';

/**
 * Devuelve el filtro de sucursal que corresponde al usuario.
 *
 * El administrador y el revisor fiscal ven todas las sucursales.
 * Los demás ven únicamente la suya.
 *
 * Uso:
 *   prisma.asociado.findMany({ where: { ...filtroSucursal(req.usuario) } })
 */
export function filtroSucursal(usuario: UsuarioAutenticado): { sucursalId?: string } {
  if (usuario.esAdministrador) {
    return {};
  }

  if (!usuario.sucursalId) {
    throw new ErrorNegocio(
      'El usuario no tiene sucursal asignada',
      'SIN_SUCURSAL',
      403,
    );
  }

  return { sucursalId: usuario.sucursalId };
}

/** Verifica que el usuario pueda operar sobre una sucursal concreta */
export function verificarAccesoASucursal(
  usuario: UsuarioAutenticado,
  sucursalId: string,
): void {
  if (usuario.esAdministrador) return;

  if (usuario.sucursalId !== sucursalId) {
    throw new ErrorNegocio(
      'No tiene acceso a esta sucursal',
      'SUCURSAL_NO_AUTORIZADA',
      403,
    );
  }
}

/** Un asociado solo puede consultar sus propios datos */
export function verificarEsPropio(
  usuario: UsuarioAutenticado,
  asociadoId: string,
): void {
  if (usuario.esAdministrador) return;
  if (usuario.empleadoId) return; // los empleados consultan a sus asociados

  if (usuario.asociadoId !== asociadoId) {
    throw new ErrorNegocio(
      'Solo puede consultar su propia información',
      'ACCESO_NO_AUTORIZADO',
      403,
    );
  }
}''