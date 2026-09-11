/**
 * Los montos llegan del backend como strings (son BigInt en centavos).
 * Estas funciones los convierten para mostrarlos.
 */

/** "150000000" -> "$1.500.000" */
export function formatearPesos(centavos: string | bigint | null | undefined): string {
  if (centavos === null || centavos === undefined) return '$0';

  const valor = Number(BigInt(centavos)) / 100;

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}

/** "150000000" -> 1500000 (para cálculos de presentación, no para dinero) */
export function centavosAPesos(centavos: string | bigint): number {
  return Number(BigInt(centavos)) / 100;
}

/** Nombre legible del tipo de cuenta */
export function nombreTipoCuenta(tipo: string): string {
  const nombres: Record<string, string> = {
    APORTES_SOCIALES: 'Aportes sociales',
    AHORRO_VOLUNTARIO: 'Ahorro voluntario',
  };
  return nombres[tipo] ?? tipo;
}