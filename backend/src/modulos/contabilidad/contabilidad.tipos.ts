import type { TipoTransaccion } from '../../generated/prisma/client.js';

/** Una línea del asiento: apunta a una cuenta de asociado O a una del fondo */
export type LineaAsiento =
  | { cuentaId: string; monto: bigint }
  | { planCuentaId: string; monto: bigint };

export interface DatosTransaccion {
  tipo: TipoTransaccion;
  descripcion?: string;
  creadoPorId: string;
  sucursalId?: string;
  cajaId?: string;
  /** Clave única que evita ejecutar dos veces la misma operación */
  claveIdempotencia: string;
  /** Fecha del reloj del sistema. Si no viene, se usa la actual. */
  fecha?: Date;
  lineas: LineaAsiento[];
}