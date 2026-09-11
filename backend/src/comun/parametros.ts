import { prisma } from './prisma.js';
import { ErrorNegocio } from './errores.js';

/**
 * Acceso a los parámetros de negocio.
 * NINGÚN número de negocio debe estar escrito en el código.
 */

const cache = new Map<string, { valor: string; vence: number }>();
const DURACION_CACHE_MS = 30000;

async function leer(clave: string): Promise<string> {
  const guardado = cache.get(clave);
  if (guardado && Date.now() < guardado.vence) {
    return guardado.valor;
  }

  const parametro = await prisma.parametro.findUnique({ where: { clave } });
  if (!parametro) {
    throw new ErrorNegocio(
      `Parámetro no configurado: ${clave}`,
      'PARAMETRO_FALTANTE',
      500,
    );
  }

  cache.set(clave, { valor: parametro.valor, vence: Date.now() + DURACION_CACHE_MS });
  return parametro.valor;
}

export async function obtenerParametroEntero(clave: string): Promise<number> {
  return Number.parseInt(await leer(clave), 10);
}

export async function obtenerParametroDecimal(clave: string): Promise<number> {
  return Number.parseFloat(await leer(clave));
}

/** Parámetros de tipo MONTO: ya vienen en centavos */
export async function obtenerParametroMonto(clave: string): Promise<bigint> {
  return BigInt(await leer(clave));
}

export async function obtenerParametroTexto(clave: string): Promise<string> {
  return leer(clave);
}

export async function obtenerParametroBooleano(clave: string): Promise<boolean> {
  return (await leer(clave)).toLowerCase() === 'true';
}

/** Invalida el caché tras editar un parámetro */
export function invalidarCacheParametros(clave?: string): void {
  if (clave) {
    cache.delete(clave);
  } else {
    cache.clear();
  }
}