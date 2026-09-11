import { randomUUID } from 'node:crypto';
import { prisma } from '../../comun/prisma.js';
import { ErrorNegocio } from '../../comun/errores.js';
import { registrarTransaccion, obtenerSaldo } from '../contabilidad/contabilidad.servicio.js';
import { obtenerParametroMonto } from '../../comun/parametros.js';
import { calcularAporteAnual } from '../asociados/asociados.servicio.js';
import type { UsuarioAutenticado } from '../auth/auth.middleware.js';

/**
 * Transferencia entre cuentas de ahorro voluntario de dos asociados.
 * Opera 24/7: no pasa por validación de horario.
 */
export async function transferir(
  cuentaOrigenId: string,
  cuentaDestinoId: string,
  monto: bigint,
  actor: UsuarioAutenticado,
  descripcion?: string,
) {
  if (monto <= 0n) {
    throw new ErrorNegocio('El monto debe ser mayor que cero', 'MONTO_INVALIDO', 400);
  }

  if (cuentaOrigenId === cuentaDestinoId) {
    throw new ErrorNegocio(
      'La cuenta de origen y destino no pueden ser la misma',
      'CUENTAS_IGUALES',
      400,
    );
  }

  const origen = await exigirCuentaTransferible(cuentaOrigenId, 'origen');
  const destino = await exigirCuentaTransferible(cuentaDestinoId, 'destino');

  // Un asociado solo transfiere desde su propia cuenta
  if (!actor.esAdministrador && actor.asociadoId !== origen.asociadoId) {
    throw new ErrorNegocio(
      'Solo puede transferir desde sus propias cuentas',
      'CUENTA_AJENA',
      403,
    );
  }

  const transaccion = await registrarTransaccion({
    tipo: 'TRANSFERENCIA',
    descripcion:
      descripcion ??
      `Transferencia de ${origen.numero} a ${destino.numero}`,
    creadoPorId: actor.id,
    sucursalId: origen.asociado.sucursalId,
    claveIdempotencia: `tr-${randomUUID()}`,
    lineas: [
      { cuentaId: cuentaOrigenId, monto },
      { cuentaId: cuentaDestinoId, monto: -monto },
    ] as any,
  });

  return {
    transaccionId: transaccion.id,
    monto,
    saldoOrigen: await obtenerSaldo(cuentaOrigenId),
    destinatario: `${destino.asociado.persona.nombres} ${destino.asociado.persona.apellidos}`,
  };
}

async function exigirCuentaTransferible(cuentaId: string, rol: 'origen' | 'destino') {
  const cuenta = await prisma.cuenta.findUnique({
    where: { id: cuentaId },
    include: {
      asociado: {
        include: { persona: { select: { nombres: true, apellidos: true } } },
      },
    },
  });

  if (!cuenta) {
    throw new ErrorNegocio(
      `La cuenta de ${rol} no existe`,
      'CUENTA_NO_ENCONTRADA',
      404,
    );
  }

  if (cuenta.tipo !== 'AHORRO_VOLUNTARIO') {
    throw new ErrorNegocio(
      'Solo se transfiere entre cuentas de ahorro voluntario',
      'TIPO_CUENTA_INVALIDO',
      409,
    );
  }

  if (cuenta.estado !== 'ACTIVA') {
    throw new ErrorNegocio(
      `La cuenta de ${rol} está ${cuenta.estado.toLowerCase()}`,
      'CUENTA_NO_OPERATIVA',
      409,
    );
  }

  if (cuenta.asociado.estado !== 'ACTIVO') {
    throw new ErrorNegocio(
      `El asociado de ${rol} está retirado`,
      'ASOCIADO_RETIRADO',
      409,
    );
  }

  return cuenta;
}

/**
 * Pago electrónico simulado. El dinero entra desde "afuera"
 * a la cuenta de Bancos del fondo.
 */
export async function pagoSimulado(
  cuentaDestinoId: string,
  monto: bigint,
  actor: UsuarioAutenticado,
  concepto: string,
) {
  if (monto <= 0n) {
    throw new ErrorNegocio('El monto debe ser mayor que cero', 'MONTO_INVALIDO', 400);
  }

  const cuenta = await prisma.cuenta.findUniqueOrThrow({
    where: { id: cuentaDestinoId },
    include: { asociado: true },
  });

  if (!actor.esAdministrador && actor.asociadoId !== cuenta.asociadoId) {
    throw new ErrorNegocio('Solo puede pagar a sus propias cuentas', 'CUENTA_AJENA', 403);
  }

  if (cuenta.estado !== 'ACTIVA') {
    throw new ErrorNegocio('La cuenta no está activa', 'CUENTA_NO_OPERATIVA', 409);
  }

  const bancos = await prisma.planCuentas.findFirstOrThrow({
    where: { codigo: '1110' },
  });

  const transaccion = await registrarTransaccion({
    tipo: 'PAGO_SIMULADO',
    descripcion: `Pago electrónico simulado: ${concepto}`,
    creadoPorId: actor.id,
    sucursalId: cuenta.asociado.sucursalId,
    claveIdempotencia: `pago-${randomUUID()}`,
    lineas: [
      { planCuentaId: bancos.id, monto },
      { cuentaId: cuentaDestinoId, monto: -monto },
    ] as any,
  });

  return {
    transaccionId: transaccion.id,
    monto,
    saldoNuevo: await obtenerSaldo(cuentaDestinoId),
  };
}

/**
 * Pago del aporte social anual mediante transferencia simulada.
 * El primero se paga en ventanilla al vincularse; los siguientes aquí.
 */
export async function pagarAporteAnual(asociadoId: string, actor: UsuarioAutenticado) {
  const asociado = await prisma.asociado.findUniqueOrThrow({
    where: { id: asociadoId },
    include: {
      cuentas: { where: { tipo: 'APORTES_SOCIALES' } },
      salarios: { orderBy: { fechaVigencia: 'desc' }, take: 1 },
    },
  });

  if (!actor.esAdministrador && actor.asociadoId !== asociadoId) {
    throw new ErrorNegocio('Solo puede pagar su propio aporte', 'CUENTA_AJENA', 403);
  }

  if (asociado.estado !== 'ACTIVO') {
    throw new ErrorNegocio('El asociado no está activo', 'ASOCIADO_INACTIVO', 409);
  }

  const salario = asociado.salarios[0]?.valor;
  if (!salario) {
    throw new ErrorNegocio(
      'El asociado no tiene salario registrado',
      'SIN_SALARIO',
      409,
    );
  }

  const cuentaAportes = asociado.cuentas[0];
  if (!cuentaAportes) {
    throw new ErrorNegocio('No tiene cuenta de aportes', 'SIN_CUENTA_APORTES', 409);
  }

  const monto = await calcularAporteAnual(salario);

  return pagoSimulado(cuentaAportes.id, monto, actor, 'Aporte social anual');
}

/** Movimientos de una cuenta, para el extracto del asociado */
export async function movimientosDeCuenta(
  cuentaId: string,
  actor: UsuarioAutenticado,
  limite = 50,
) {
  const cuenta = await prisma.cuenta.findUniqueOrThrow({
    where: { id: cuentaId },
    select: { asociadoId: true },
  });

  if (
    !actor.esAdministrador &&
    !actor.empleadoId &&
    actor.asociadoId !== cuenta.asociadoId
  ) {
    throw new ErrorNegocio('No puede consultar esta cuenta', 'ACCESO_NO_AUTORIZADO', 403);
  }

  const asientos = await prisma.asiento.findMany({
    where: { cuentaId },
    include: {
      transaccion: {
        select: { id: true, fecha: true, tipo: true, descripcion: true },
      },
    },
    orderBy: { transaccion: { fecha: 'desc' } },
    take: limite,
  });

  // El signo se invierte para presentación: positivo = entró plata
  return asientos.map((a) => ({
    id: a.id,
    fecha: a.transaccion.fecha,
    tipo: a.transaccion.tipo,
    descripcion: a.transaccion.descripcion,
    monto: -a.monto,
  }));
}