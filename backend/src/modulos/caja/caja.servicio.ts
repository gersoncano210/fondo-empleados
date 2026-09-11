import { prisma } from '../../comun/prisma.js';
import { ahora } from '../../comun/reloj.js';
import { ErrorNegocio } from '../../comun/errores.js';
import { obtenerSaldoPlan } from '../contabilidad/contabilidad.servicio.js';
import type { UsuarioAutenticado } from '../auth/auth.middleware.js';
import { filtroSucursal } from '../../comun/alcance.js';

/** Abre el turno de caja de un cajero */
export async function abrirCaja(actor: UsuarioAutenticado, saldoInicial: bigint = 0n) {
  if (!actor.empleadoId) {
    throw new ErrorNegocio('Solo un empleado puede abrir caja', 'NO_ES_EMPLEADO', 403);
  }
  if (!actor.sucursalId) {
    throw new ErrorNegocio('El empleado no tiene sucursal', 'SIN_SUCURSAL', 403);
  }

  const abierta = await prisma.caja.findFirst({
    where: { cajeroId: actor.empleadoId, estado: 'ABIERTA' },
  });

  if (abierta) {
    throw new ErrorNegocio('Ya tiene una caja abierta', 'CAJA_YA_ABIERTA', 409);
  }

  return prisma.caja.create({
    data: {
      sucursalId: actor.sucursalId,
      cajeroId: actor.empleadoId,
      fechaApertura: await ahora(),
      saldoInicial,
      estado: 'ABIERTA',
    },
  });
}

/** Cierra el turno y hace el arqueo */
export async function cerrarCaja(
  cajaId: string,
  saldoContado: bigint,
  actor: UsuarioAutenticado,
) {
  const caja = await prisma.caja.findFirstOrThrow({
    where: { id: cajaId, ...filtroSucursal(actor) },
  });

  if (caja.estado !== 'ABIERTA') {
    throw new ErrorNegocio('La caja no está abierta', 'CAJA_CERRADA', 409);
  }

  const planCuenta = await prisma.planCuentas.findFirstOrThrow({
    where: { sucursalId: caja.sucursalId, familia: 'ACTIVO' },
  });

  const saldoSistema = await obtenerSaldoPlan(planCuenta.id);
  const diferencia = saldoContado - saldoSistema;

  return prisma.caja.update({
    where: { id: cajaId },
    data: {
      fechaCierre: await ahora(),
      saldoFinalContado: saldoContado,
      saldoFinalSistema: saldoSistema,
      diferencia,
      estado: diferencia === 0n ? 'CUADRADA' : 'DESCUADRADA',
    },
  });
}

/** La caja abierta del cajero actual, si tiene alguna */
export async function miCajaAbierta(actor: UsuarioAutenticado) {
  if (!actor.empleadoId) return null;

  return prisma.caja.findFirst({
    where: { cajeroId: actor.empleadoId, estado: 'ABIERTA' },
    include: { sucursal: { select: { nombre: true } } },
  });
}