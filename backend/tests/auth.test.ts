import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/comun/prisma.js';
import { iniciarSesion, hashearContrasena } from '../src/modulos/auth/auth.servicio.js';
import {
  emitirTokenRefresco,
  rotarTokenRefresco,
  revocarTokenRefresco,
  verificarTokenAcceso,
  firmarTokenAcceso,
} from '../src/modulos/auth/tokens.servicio.js';
import { filtroSucursal } from '../src/comun/alcance.js';
import { ErrorNegocio } from '../src/comun/errores.js';
import { sufijoUnico } from './ayudantes.js';

const CONTRASENA = 'Prueba2026*';
let usuarioId: string;
let correo: string;
let sucursalId: string;

beforeAll(async () => {
  const sufijo = sufijoUnico();
  correo = `test-${sufijo}@fondo.local`;

  const sucursal = await prisma.sucursal.findFirstOrThrow();
  sucursalId = sucursal.id;

  const persona = await prisma.persona.create({
    data: {
      tipoDocumento: 'CC',
      numeroDocumento: `TEST-${sufijo}`,
      nombres: 'Usuario',
      apellidos: 'De Prueba',
    },
  });

  await prisma.empleado.create({
    data: {
      personaId: persona.id,
      codigoEmpleado: `EMP-${sufijo}`,
      cargo: 'ASESOR',
      sucursalId,
      fechaIngreso: new Date(),
      salarioFondo: 300_000_000n,
    },
  });

  const usuario = await prisma.usuario.create({
    data: {
      personaId: persona.id,
      correoAcceso: correo,
      hashContrasena: await hashearContrasena(CONTRASENA),
    },
  });
  usuarioId = usuario.id;

  const rolAsesor = await prisma.rol.findUniqueOrThrow({ where: { nombre: 'ASESOR' } });
  await prisma.usuarioRol.create({ data: { usuarioId, rolId: rolAsesor.id } });
});

afterAll(async () => {
  await prisma.tokenRefresco.deleteMany({ where: { usuarioId } });
  await prisma.usuarioRol.deleteMany({ where: { usuarioId } });
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (usuario) {
    await prisma.usuario.delete({ where: { id: usuarioId } });
    await prisma.empleado.deleteMany({ where: { personaId: usuario.personaId } });
    await prisma.persona.delete({ where: { id: usuario.personaId } });
  }
  await prisma.$disconnect();
});

describe('inicio de sesión', () => {
  it('entra con credenciales correctas', async () => {
    const resultado = await iniciarSesion(correo, CONTRASENA);

    expect(resultado.tokenAcceso).toBeDefined();
    expect(resultado.tokenRefresco).toBeDefined();
    expect(resultado.usuario.correoAcceso).toBe(correo);
    expect(resultado.usuario.roles).toContain('ASESOR');
  });

  it('rechaza contraseña incorrecta', async () => {
    await expect(iniciarSesion(correo, 'incorrecta')).rejects.toThrow(ErrorNegocio);
  });

  it('da el mismo mensaje si el correo no existe', async () => {
    // No debe revelar qué correos están registrados
    let mensajeCorreoMalo = '';
    let mensajeClaveMala = '';

    await iniciarSesion('noexiste@fondo.local', 'x').catch((e) => {
      mensajeCorreoMalo = e.message;
    });
    await iniciarSesion(correo, 'incorrecta').catch((e) => {
      mensajeClaveMala = e.message;
    });

    expect(mensajeCorreoMalo).toBe(mensajeClaveMala);
  });

  it('el asesor recibe sus permisos, no los del administrador', async () => {
    const resultado = await iniciarSesion(correo, CONTRASENA);

    expect(resultado.usuario.permisos).toContain('asociado.crear');
    expect(resultado.usuario.permisos).toContain('credito.aprobar.asesor');
    expect(resultado.usuario.permisos).not.toContain('credito.aprobar.gerente');
    expect(resultado.usuario.permisos).not.toContain('parametro.editar');
  });
});

describe('tokens de acceso', () => {
  it('firma y verifica un token válido', () => {
    const token = firmarTokenAcceso({ usuarioId, personaId: 'p-1' });
    const contenido = verificarTokenAcceso(token);

    expect(contenido.usuarioId).toBe(usuarioId);
  });

  it('rechaza un token manipulado', () => {
    const token = firmarTokenAcceso({ usuarioId, personaId: 'p-1' });
    const manipulado = token.slice(0, -5) + 'xxxxx';

    expect(() => verificarTokenAcceso(manipulado)).toThrow(ErrorNegocio);
  });

  it('rechaza basura', () => {
    expect(() => verificarTokenAcceso('esto-no-es-un-token')).toThrow(ErrorNegocio);
  });
});

describe('tokens de refresco', () => {
  it('rota el token: el viejo deja de servir', async () => {
    const original = await emitirTokenRefresco(usuarioId);
    const { tokenNuevo } = await rotarTokenRefresco(original);

    expect(tokenNuevo).not.toBe(original);
    // El original ya fue revocado
    await expect(rotarTokenRefresco(original)).rejects.toThrow(ErrorNegocio);
  });

  it('reutilizar un token revocado cierra todas las sesiones', async () => {
    const tokenA = await emitirTokenRefresco(usuarioId);
    const tokenB = await emitirTokenRefresco(usuarioId);

    // Se rota A (simula el uso legítimo)
    await rotarTokenRefresco(tokenA);

    // Alguien intenta reutilizar A (simula el robo)
    await expect(rotarTokenRefresco(tokenA)).rejects.toThrow(/reutilizado/i);

    // B también quedó revocado por seguridad
    await expect(rotarTokenRefresco(tokenB)).rejects.toThrow(ErrorNegocio);
  });

  it('un token revocado no sirve', async () => {
    const token = await emitirTokenRefresco(usuarioId);
    await revocarTokenRefresco(token);

    await expect(rotarTokenRefresco(token)).rejects.toThrow(ErrorNegocio);
  });

  it('rechaza un token inexistente', async () => {
    await expect(rotarTokenRefresco('token-inventado')).rejects.toThrow(ErrorNegocio);
  });
});

describe('aislamiento por sucursal', () => {
  it('el administrador no recibe filtro', () => {
    const filtro = filtroSucursal({
      id: 'u-1', personaId: 'p-1', permisos: [], roles: ['ADMINISTRADOR'],
      sucursalId: null, esAdministrador: true, asociadoId: null, empleadoId: 'e-1',
    });

    expect(filtro).toEqual({});
  });

  it('el gerente queda limitado a su sucursal', () => {
    const filtro = filtroSucursal({
      id: 'u-2', personaId: 'p-2', permisos: [], roles: ['GERENTE'],
      sucursalId, esAdministrador: false, asociadoId: null, empleadoId: 'e-2',
    });

    expect(filtro).toEqual({ sucursalId });
  });

  it('el revisor fiscal ve todas las sucursales', () => {
    const filtro = filtroSucursal({
      id: 'u-3', personaId: 'p-3', permisos: [], roles: ['REVISOR_FISCAL'],
      sucursalId, esAdministrador: true, asociadoId: null, empleadoId: 'e-3',
    });

    expect(filtro).toEqual({});
  });

  it('falla si no tiene sucursal asignada', () => {
    expect(() =>
      filtroSucursal({
        id: 'u-4', personaId: 'p-4', permisos: [], roles: ['CAJERO'],
        sucursalId: null, esAdministrador: false, asociadoId: null, empleadoId: 'e-4',
      }),
    ).toThrow(ErrorNegocio);
  });
});