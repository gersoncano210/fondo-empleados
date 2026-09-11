import { hash, verify } from '@node-rs/argon2';
import { prisma } from '../../comun/prisma.js';
import { ErrorNegocio } from '../../comun/errores.js';
import { obtenerParametroEntero } from '../../comun/parametros.js';
import {
  firmarTokenAcceso,
  emitirTokenRefresco,
  rotarTokenRefresco,
} from './tokens.servicio.js';

export interface ResultadoLogin {
  tokenAcceso: string;
  tokenRefresco: string;
  usuario: {
    id: string;
    correoAcceso: string;
    nombres: string;
    apellidos: string;
    roles: string[];
    permisos: string[];
    sucursalId: string | null;
    esEmpleado: boolean;
    esAsociado: boolean;
  };
}

export async function iniciarSesion(
  correo: string,
  contrasena: string,
  ip?: string,
): Promise<ResultadoLogin> {
  const usuario = await prisma.usuario.findUnique({
    where: { correoAcceso: correo.toLowerCase().trim() },
    include: {
      persona: {
        include: {
          empleado: { select: { sucursalId: true, estado: true } },
          asociado: { select: { sucursalId: true, estado: true } },
        },
      },
      roles: { include: { rol: true } },
    },
  });

  // Mensaje idéntico exista o no el usuario: no revelamos qué correos están registrados
  if (!usuario) {
    throw new ErrorNegocio('Credenciales incorrectas', 'CREDENCIALES_INVALIDAS', 401);
  }

  if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
    throw new ErrorNegocio(
      'Cuenta bloqueada temporalmente por intentos fallidos',
      'CUENTA_BLOQUEADA',
      423,
    );
  }

  if (usuario.estado !== 'ACTIVO') {
    throw new ErrorNegocio('La cuenta no está activa', 'CUENTA_INACTIVA', 403);
  }

  const correcta = await verify(usuario.hashContrasena, contrasena);

  if (!correcta) {
    await registrarIntentoFallido(usuario.id, usuario.intentosFallidos);
    throw new ErrorNegocio('Credenciales incorrectas', 'CREDENCIALES_INVALIDAS', 401);
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: new Date() },
  });

  const permisos = await obtenerPermisosDeUsuario(usuario.id);

  const tokenAcceso = firmarTokenAcceso({
    usuarioId: usuario.id,
    personaId: usuario.personaId,
  });
  const tokenRefresco = await emitirTokenRefresco(usuario.id, ip);

  return {
    tokenAcceso,
    tokenRefresco,
    usuario: {
      id: usuario.id,
      correoAcceso: usuario.correoAcceso,
      nombres: usuario.persona.nombres,
      apellidos: usuario.persona.apellidos,
      roles: usuario.roles.map((ur) => ur.rol.nombre),
      permisos,
      sucursalId:
        usuario.persona.empleado?.sucursalId ??
        usuario.persona.asociado?.sucursalId ??
        null,
      esEmpleado: usuario.persona.empleado?.estado === 'ACTIVO',
      esAsociado: usuario.persona.asociado?.estado === 'ACTIVO',
    },
  };
}

async function registrarIntentoFallido(
  usuarioId: string,
  intentosPrevios: number,
): Promise<void> {
  const maximo = await obtenerParametroEntero('seguridad.intentos_max');
  const minutos = await obtenerParametroEntero('seguridad.minutos_bloqueo');

  const intentos = intentosPrevios + 1;
  const bloquear = intentos >= maximo;

  const bloqueadoHasta = new Date();
  bloqueadoHasta.setMinutes(bloqueadoHasta.getMinutes() + minutos);

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      intentosFallidos: bloquear ? 0 : intentos,
      bloqueadoHasta: bloquear ? bloqueadoHasta : null,
    },
  });
}

/** Todos los permisos del usuario, unificados de todos sus roles */
export async function obtenerPermisosDeUsuario(usuarioId: string): Promise<string[]> {
  const filas = await prisma.usuarioRol.findMany({
    where: { usuarioId },
    include: {
      rol: { include: { permisos: { include: { permiso: true } } } },
    },
  });

  const claves = new Set<string>();
  for (const fila of filas) {
    for (const rp of fila.rol.permisos) {
      claves.add(rp.permiso.clave);
    }
  }

  return [...claves];
}

/** Renueva el token de acceso usando el de refresco */
export async function refrescarSesion(tokenRefresco: string, ip?: string) {
  const { usuarioId, tokenNuevo } = await rotarTokenRefresco(tokenRefresco, ip);

  const usuario = await prisma.usuario.findUniqueOrThrow({
    where: { id: usuarioId },
    select: { id: true, personaId: true, estado: true },
  });

  if (usuario.estado !== 'ACTIVO') {
    throw new ErrorNegocio('La cuenta no está activa', 'CUENTA_INACTIVA', 403);
  }

  return {
    tokenAcceso: firmarTokenAcceso({
      usuarioId: usuario.id,
      personaId: usuario.personaId,
    }),
    tokenRefresco: tokenNuevo,
  };
}

/** Para crear usuarios desde otros módulos */
export async function hashearContrasena(contrasena: string): Promise<string> {
  return hash(contrasena);
}