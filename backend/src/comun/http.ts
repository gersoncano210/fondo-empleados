import type { Request } from 'express';

/** Express 5 tipa los parámetros como string | string[]. Normaliza a string. */
export function param(req: Request, nombre: string): string {
  const valor = req.params[nombre];
  return Array.isArray(valor) ? valor[0]! : valor!;
}

/** Convierte BigInt a string para que JSON.stringify no falle */
export function serializar(valor: unknown): unknown {
  return JSON.parse(
    JSON.stringify(valor, (_clave, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );
}