import { prisma } from '../../comun/prisma.js';
import { ahora } from '../../comun/reloj.js';
import { ErrorNegocio } from '../../comun/errores.js';
import { obtenerSaldoPlan } from '../contabilidad/contabilidad.servicio.js';
import type { UsuarioAutenticado } from '../auth/auth.middleware.js';
import { filtroSucursal } from '../../comun/alcance.js';
import { registrarTransaccion, obtenerSaldo } from '../contabilidad/contabilidad.servicio.js';
import { verificarHorarioVentanilla } from '../../comun/horario.js';
import { obtenerParametroMonto } from '../../comun/parametros.js';
import { randomUUID } from 'node:crypto';

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



/** Datos de la caja abierta del cajero, con su cuenta contable */
async function exigirCajaAbierta(actor: UsuarioAutenticado) {
  if (!actor.empleadoId) {
    throw new ErrorNegocio('Solo un empleado opera la caja', 'NO_ES_EMPLEADO', 403);
  }

  const caja = await prisma.caja.findFirst({
    where: { cajeroId: actor.empleadoId, estado: 'ABIERTA' },
  });

  if (!caja) {
    throw new ErrorNegocio('Debe abrir caja antes de operar', 'SIN_CAJA_ABIERTA', 409);
  }

  const planCuenta = await prisma.planCuentas.findFirstOrThrow({
    where: { sucursalId: caja.sucursalId, familia: 'ACTIVO' },
  });

  return { caja, planCuentaId: planCuenta.id };
}

/** Valida que la cuenta exista, esté activa y sea operable por este cajero */
async function exigirCuentaOperable(cuentaId: string, actor: UsuarioAutenticado) {
  const cuenta = await prisma.cuenta.findUniqueOrThrow({
    where: { id: cuentaId },
    include: {
      asociado: {
        include: { persona: { select: { nombres: true, apellidos: true } } },
      },
    },
  });

  if (cuenta.estado !== 'ACTIVA') {
    throw new ErrorNegocio(
      `La cuenta está ${cuenta.estado.toLowerCase()}`,
      'CUENTA_NO_OPERATIVA',
      409,
    );
  }

  if (cuenta.asociado.estado !== 'ACTIVO') {
    throw new ErrorNegocio('El asociado está retirado', 'ASOCIADO_RETIRADO', 409);
  }

  return cuenta;
}

/** Depósito en efectivo por ventanilla */
export async function depositar(
  cuentaId: string,
  monto: bigint,
  actor: UsuarioAutenticado,
  referencia?: string,
) {
  await verificarHorarioVentanilla();

  if (monto <= 0n) {
    throw new ErrorNegocio('El monto debe ser mayor que cero', 'MONTO_INVALIDO', 400);
  }

  const { caja, planCuentaId } = await exigirCajaAbierta(actor);
  const cuenta = await exigirCuentaOperable(cuentaId, actor);

  const transaccion = await registrarTransaccion({
    tipo: 'DEPOSITO_VENTANILLA',
    descripcion: `Depósito a ${cuenta.numero} — ${cuenta.asociado.persona.nombres} ${cuenta.asociado.persona.apellidos}`,
    creadoPorId: actor.id,
    sucursalId: caja.sucursalId,
    cajaId: caja.id,
    claveIdempotencia: referencia ?? `dep-${randomUUID()}`,
    lineas: [
      { planCuentaId, monto },
      { cuentaId, monto: -monto },
    ] as any,
  });

  return {
    transaccionId: transaccion.id,
    cuentaId,
    monto,
    saldoNuevo: await obtenerSaldo(cuentaId),
  };
}

/**
 * Retiro en efectivo por ventanilla.
 * Sobre el tope parametrizado requiere autorización del gerente.
 */
export async function retirar(
  cuentaId: string,
  monto: bigint,
  actor: UsuarioAutenticado,
  opciones: { autorizadoPorId?: string; referencia?: string } = {},
) {
  await verificarHorarioVentanilla();

  if (monto <= 0n) {
    throw new ErrorNegocio('El monto debe ser mayor que cero', 'MONTO_INVALIDO', 400);
  }

  const { caja, planCuentaId } = await exigirCajaAbierta(actor);
  const cuenta = await exigirCuentaOperable(cuentaId, actor);

  if (cuenta.tipo === 'APORTES_SOCIALES') {
    throw new ErrorNegocio(
      'Los aportes sociales solo se retiran al desafiliarse',
      'APORTES_NO_RETIRABLES',
      409,
    );
  }

  const tope = await obtenerParametroMonto('retiro.tope_sin_autorizacion');

  if (monto > tope && !opciones.autorizadoPorId) {
    throw new ErrorNegocio(
      `Los retiros superiores a ${tope / 100n} pesos requieren autorización del gerente`,
      'REQUIERE_AUTORIZACION',
      403,
    );
  }

  if (opciones.autorizadoPorId) {
    await verificarAutorizador(opciones.autorizadoPorId, caja.sucursalId);
  }

  // El efectivo debe alcanzar en la caja
  const efectivoEnCaja = await obtenerSaldoPlan(planCuentaId);
  if (efectivoEnCaja < monto) {
    throw new ErrorNegocio(
      'La caja no tiene efectivo suficiente para este retiro',
      'EFECTIVO_INSUFICIENTE',
      409,
    );
  }

  const transaccion = await registrarTransaccion({
    tipo: 'RETIRO_VENTANILLA',
    descripcion: `Retiro de ${cuenta.numero} — ${cuenta.asociado.persona.nombres} ${cuenta.asociado.persona.apellidos}`,
    creadoPorId: actor.id,
    sucursalId: caja.sucursalId,
    cajaId: caja.id,
    claveIdempotencia: opciones.referencia ?? `ret-${randomUUID()}`,
    lineas: [
      { cuentaId, monto },
      { planCuentaId, monto: -monto },
    ] as any,
  });

  return {
    transaccionId: transaccion.id,
    cuentaId,
    monto,
    saldoNuevo: await obtenerSaldo(cuentaId),
  };
}

/** Quien autoriza un retiro grande debe ser gerente de esa sucursal */
async function verificarAutorizador(usuarioId: string, sucursalId: string) {
  const usuario = await prisma.usuario.findUniqueOrThrow({
    where: { id: usuarioId },
    include: {
      persona: { include: { empleado: true } },
      roles: { include: { rol: { include: { permisos: { include: { permiso: true } } } } } },
    },
  });

  const puede = usuario.roles.some((ur) =>
    ur.rol.permisos.some((rp) => rp.permiso.clave === 'caja.autorizar_retiro'),
  );

  if (!puede) {
    throw new ErrorNegocio(
      'El usuario indicado no puede autorizar retiros',
      'AUTORIZADOR_INVALIDO',
      403,
    );
  }

  const empleado = usuario.persona.empleado;
  const esAdmin = usuario.roles.some((ur) => ur.rol.nombre === 'ADMINISTRADOR');

  if (!esAdmin && empleado?.sucursalId !== sucursalId) {
    throw new ErrorNegocio(
      'El autorizador no pertenece a esta sucursal',
      'AUTORIZADOR_OTRA_SUCURSAL',
      403,
    );
  }
}

/** Movimientos registrados en un turno de caja */
export async function movimientosDeCaja(cajaId: string, actor: UsuarioAutenticado) {
  await prisma.caja.findFirstOrThrow({
    where: { id: cajaId, ...filtroSucursal(actor) },
  });

  return prisma.transaccion.findMany({
    where: { cajaId },
    include: {
      asientos: {
        include: { cuenta: { select: { numero: true, tipo: true } } },
      },
    },
    orderBy: { fecha: 'desc' },
  });
}