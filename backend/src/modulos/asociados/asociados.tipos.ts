export interface DatosVinculacion {
  // Persona
  tipoDocumento: 'CC' | 'CE' | 'PASAPORTE';
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento?: Date;
  direccion?: string;
  telefono?: string;
  correoPersonal?: string;
  contactoEmergenciaNombre?: string;
  contactoEmergenciaTelefono?: string;

  // Vínculo con la empresa
  cargoEmpresa: string;
  salarioMensual: bigint;

  // Vínculo con el fondo
  sucursalId: string;
  asesorAsignadoId?: string;

  // Acceso
  correoAcceso: string;
  contrasenaInicial: string;

  // Pago de la afiliación
  cajaId: string;
  pagaAporteInicial: boolean;
}