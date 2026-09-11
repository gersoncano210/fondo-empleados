export type TipoCuenta = 'APORTES_SOCIALES' | 'AHORRO_VOLUNTARIO';
export type EstadoCuenta = 'ACTIVA' | 'BLOQUEADA' | 'CERRADA';

export interface SaldoCuenta {
  cuentaId: string;
  tipo: TipoCuenta;
  numero: string;
  estado: EstadoCuenta;
  /** Llega como string desde el backend: es un BigInt en centavos */
  saldo: string;
}

export interface PerfilAsociado {
  id: string;
  numeroAsociado: string;
  fechaAfiliacion: string;
  cargoEmpresa: string | null;
  estado: string;
  mesesAfiliado: number;
  salarioVigente: string;
  persona: {
    nombres: string;
    apellidos: string;
    numeroDocumento: string;
    telefono: string | null;
    direccion: string | null;
    correoPersonal: string | null;
  };
  sucursal: { id: string; nombre: string; ciudad: string };
  saldos: SaldoCuenta[];
}