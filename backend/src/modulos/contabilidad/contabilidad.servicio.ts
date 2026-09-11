import { prisma, type PrismaTx } from '../../comun/prisma.js';
import { sumar } from '../../comun/dinero.js';
import {
  AsientosDesbalanceados,
  SaldoInsuficiente,
  CuentaNoOperativa,
  TransaccionDuplicada,
} from '../../comun/errores.js';
import type { DatosTransaccion, LineaAsiento } from './contabilidad.tipos.js';
import { ahora } from '../../comun/reloj.js';
/**
 * Registra un movimiento de dinero en el libro contable.
 *
 * Esta es la ÚNICA función del sistema autorizada a escribir asientos.
 * Ningún otro módulo puede insertar en Asiento directamente.
 */
export async function registrarTransaccion(datos: DatosTransaccion) {
  validarBalance(datos.lineas);

  return prisma.$transaction(async (tx) => {
    await verificarIdempotencia(tx, datos.claveIdempotencia);

    const transaccion = await tx.transaccion.create({
      data: {
        tipo: datos.tipo,
        descripcion: datos.descripcion,
        creadoPorId: datos.creadoPorId,
        sucursalId: datos.sucursalId,
        cajaId: datos.cajaId,
        claveIdempotencia: datos.claveIdempotencia,
        fecha: datos.fecha ?? (await ahora()),
      },
    });

    for (const [indice, linea] of datos.lineas.entries()) {
      await tx.asiento.create({
        data: {
          transaccionId: transaccion.id,
          cuentaId: 'cuentaId' in linea ? linea.cuentaId : null,
          planCuentaId: 'planCuentaId' in linea ? linea.planCuentaId : null,
          monto: linea.monto,
          orden: indice + 1,
        },
      });

      await aplicarASaldo(tx, linea);
    }

    return transaccion;
  }, {
    isolationLevel: 'Serializable',
  });
}

/** La regla fundamental: las líneas deben sumar exactamente cero */
function validarBalance(lineas: LineaAsiento[]): void {
  if (lineas.length < 2) {
    throw new AsientosDesbalanceados(0n);
  }

  const total = sumar(lineas.map((l) => l.monto));

  if (total !== 0n) {
    throw new AsientosDesbalanceados(total);
  }
}

/** Si la clave ya existe, la operación ya se ejecutó */
async function verificarIdempotencia(tx: PrismaTx, clave: string): Promise<void> {
  const existente = await tx.transaccion.findUnique({
    where: { claveIdempotencia: clave },
  });

  if (existente) {
    throw new TransaccionDuplicada(clave);
  }
}

/**
 * Actualiza el saldo en caché de la cuenta afectada por una línea.
 *
 * Usa SELECT ... FOR UPDATE para bloquear la fila mientras se calcula.
 * Sin ese bloqueo, dos retiros simultáneos podrían leer el mismo saldo
 * y ambos pasar la verificación, dejando la cuenta en negativo.
 */
async function aplicarASaldo(tx: PrismaTx, linea: LineaAsiento): Promise<void> {
  if ('cuentaId' in linea) {
    await aplicarASaldoCuenta(tx, linea.cuentaId, linea.monto);
  } else {
    await aplicarASaldoPlan(tx, linea.planCuentaId, linea.monto);
  }
}

async function aplicarASaldoCuenta(
  tx: PrismaTx,
  cuentaId: string,
  monto: bigint,
): Promise<void> {
  const cuenta = await tx.cuenta.findUniqueOrThrow({
    where: { id: cuentaId },
    select: { id: true, estado: true },
  });

  if (cuenta.estado !== 'ACTIVA') {
    throw new CuentaNoOperativa(cuentaId, cuenta.estado);
  }

  // Bloquea la fila del saldo hasta que termine la transacción
  const filas = await tx.$queryRaw<Array<{ saldo: bigint }>>`
    SELECT saldo FROM "SaldoCache" WHERE "cuentaId" = ${cuentaId} FOR UPDATE
  `;

  const saldoActual = filas[0]?.saldo ?? 0n;

  // El saldo de una cuenta de asociado es el NEGATIVO de la suma de asientos,
  // porque para el fondo esas cuentas son pasivos.
  const saldoNuevo = saldoActual - monto;

  if (saldoNuevo < 0n) {
    throw new SaldoInsuficiente(saldoActual, monto);
  }

  await tx.saldoCache.upsert({
    where:  { cuentaId },
    update: { saldo: saldoNuevo },
    create: { cuentaId, saldo: saldoNuevo },
  });
}

async function aplicarASaldoPlan(
  tx: PrismaTx,
  planCuentaId: string,
  monto: bigint,
): Promise<void> {
  await tx.$queryRaw`
    SELECT saldo FROM "SaldoCachePlan" WHERE "planCuentaId" = ${planCuentaId} FOR UPDATE
  `;

  const cache = await tx.saldoCachePlan.findUnique({ where: { planCuentaId } });
  const saldoActual = cache?.saldo ?? 0n;
  const saldoNuevo = saldoActual + monto;

  await tx.saldoCachePlan.upsert({
    where:  { planCuentaId },
    update: { saldo: saldoNuevo },
    create: { planCuentaId, saldo: saldoNuevo },
  });
}

/** Saldo actual de una cuenta de asociado */
export async function obtenerSaldo(cuentaId: string): Promise<bigint> {
  const cache = await prisma.saldoCache.findUnique({ where: { cuentaId } });
  return cache?.saldo ?? 0n;
}

/** Saldo actual de una cuenta del fondo */
export async function obtenerSaldoPlan(planCuentaId: string): Promise<bigint> {
  const cache = await prisma.saldoCachePlan.findUnique({ where: { planCuentaId } });
  return cache?.saldo ?? 0n;
}

/**
 * Verificación de integridad global: la suma de TODOS los asientos
 * del sistema debe dar exactamente cero.
 */
export async function verificarBalanceGlobal(): Promise<{
  balanceado: boolean;
  diferencia: bigint;
}> {
  const resultado = await prisma.$queryRaw<Array<{ total: unknown }>>`
    SELECT COALESCE(SUM(monto), 0) AS total FROM "Asiento"
  `;

  // $queryRaw no convierte tipos: PostgreSQL devuelve numeric como string.
  const crudo = resultado[0]?.total ?? 0;
  const diferencia = BigInt(String(crudo));

  return { balanceado: diferencia === 0n, diferencia };
}

/** Movimientos de una cuenta, del más reciente al más antiguo */
export async function obtenerMovimientos(cuentaId: string, limite = 50) {
  return prisma.asiento.findMany({
    where: { cuentaId },
    include: {
      transaccion: {
        select: { id: true, fecha: true, tipo: true, descripcion: true },
      },
    },
    orderBy: { transaccion: { fecha: 'desc' } },
    take: limite,
  });
}