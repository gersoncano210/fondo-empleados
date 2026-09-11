export interface Usuario {
  id: string;
  correoAcceso: string;
  nombres: string;
  apellidos: string;
  roles: string[];
  permisos: string[];
  sucursalId: string | null;
  esAsociado: boolean;
  esEmpleado: boolean;
}

export interface Credenciales {
  correo: string;
  contrasena: string;
}