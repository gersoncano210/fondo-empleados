import { prisma } from './prisma.js';

/**
 * Fuente única de la fecha del sistema.
 *
 * NINGÚN otro archivo del proyecto debe llamar a new Date() para lógica
 * de negocio. En modo SIMULADO el administrador puede adelantar la fecha
 * para probar mora, cierres de mes y cálculos de intereses.
 */

let cacheModo: 'REAL' | 'SIMULADO' = 'REAL';
let cacheFecha: Date | null = null;
let cacheVence = 0;

const DURACION_CACHE_MS = 5000;

/** La fecha actual según el sistema */
export async function ahora(): Promise<Date> {
  if (Date.now() > cacheVence) {
    await refrescarCache();
  }
  return cacheModo === 'SIMULADO' && cacheFecha ? new Date(cacheFecha) : new Date();
}

/** Solo la fecha, sin hora (útil para vencimientos y comparaciones por día) */
export async function hoy(): Promise<Date> {
  const fecha = await ahora();
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

async function refrescarCache(): Promise<void> {
  const reloj = await prisma.relojSistema.findUnique({ where: { id: 1 } });
  cacheModo = reloj?.modo ?? 'REAL';
  cacheFecha = reloj?.fechaSimulada ?? null;
  cacheVence = Date.now() + DURACION_CACHE_MS;
}

/** Cambia a modo simulado con una fecha concreta */
export async function fijarFechaSimulada(fecha: Date, usuarioId: string): Promise<void> {
  await prisma.relojSistema.update({
    where: { id: 1 },
    data: { modo: 'SIMULADO', fechaSimulada: fecha, actualizadoPorId: usuarioId },
  });
  cacheVence = 0;
}

/** Adelanta el reloj simulado una cantidad de días */
export async function adelantarDias(dias: number, usuarioId: string): Promise<Date> {
  const actual = await ahora();
  const nueva = new Date(actual);
  nueva.setDate(nueva.getDate() + dias);
  await fijarFechaSimulada(nueva, usuarioId);
  return nueva;
}

/** Vuelve a usar la fecha real */
export async function volverATiempoReal(usuarioId: string): Promise<void> {
  await prisma.relojSistema.update({
    where: { id: 1 },
    data: { modo: 'REAL', fechaSimulada: null, actualizadoPorId: usuarioId },
  });
  cacheVence = 0;
}

/** Estado actual del reloj, para mostrarlo en el panel del administrador */
export async function estadoReloj() {
  const reloj = await prisma.relojSistema.findUnique({ where: { id: 1 } });
  return {
    modo: reloj?.modo ?? 'REAL',
    fechaSimulada: reloj?.fechaSimulada ?? null,
    fechaEfectiva: await ahora(),
  };
}
