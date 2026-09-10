/**
 * Todo el dinero del sistema se maneja en CENTAVOS, como BigInt.
 * $1.000.000 se representa como 100000000n
 *
 * Nunca usar number para montos: los flotantes pierden precisión.
 * 0.1 + 0.2 === 0.30000000000000004
 */

export type Centavos = bigint;

/** Convierte pesos a centavos. Acepta decimales: 1500.50 -> 150050n */
export function pesosACentavos(pesos: number): Centavos {
  if (!Number.isFinite(pesos)) {
    throw new Error(`Monto inválido: ${pesos}`);
  }
  return BigInt(Math.round(pesos * 100));
}

/** Convierte centavos a pesos. Solo para mostrar, nunca para calcular. */
export function centavosAPesos(centavos: Centavos): number {
  return Number(centavos) / 100;
}

/** Formatea para mostrar al usuario: 100000000n -> "$1.000.000" */
export function formatearPesos(centavos: Centavos): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(centavosAPesos(centavos));
}

/**
 * Aplica un porcentaje a un monto, redondeando al centavo más cercano.
 * Ej: 1,5% de $1.000.000 -> aplicarPorcentaje(100000000n, 1.5) -> 1500000n
 */
export function aplicarPorcentaje(monto: Centavos, porcentaje: number): Centavos {
  // Se escala por 10000 para no perder precisión con decimales del porcentaje
  const escalado = BigInt(Math.round(porcentaje * 10000));
  return (monto * escalado) / 1000000n;
}

/** Suma una lista de montos */
export function sumar(montos: Centavos[]): Centavos {
  return montos.reduce((acumulado, actual) => acumulado + actual, 0n);
}

/** Valor absoluto de un BigInt */
export function absoluto(monto: Centavos): Centavos {
  return monto < 0n ? -monto : monto;
}