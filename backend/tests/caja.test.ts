import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { prisma } from '../src/comun/prisma.js';
import { depositar, retirar, abrirCaja, cerrarCaja } from '../src/modulos/caja/caja.servicio.js';
import { obtenerSaldo, verificarBalanceGlobal } from '../src/modulos/contabilidad/contabilidad.servicio.js';
import { ErrorNegocio } from '../src/comun/errores.js';
import * as horario from '../src/comun/horario.js';
import {
  crearAsociadoDePrueba,
  limpiarDatosDePrueba,
  sufijoUnico,
} from './ayudantes.js';
import type { UsuarioAutenticado } from '../src/modulos/auth/auth.middleware.js';

let juan: Awaited<ReturnType<typeof crearAsociadoDePrueba>>;
let cajero: UsuarioAutenticado;
let cajaId: string;
let personaCajeroId: string;
let usuarioCajeroId: string;

beforeEach(async () => {
  // La ventanilla siempre "abierta" durante las pruebas
  vi.spyOn(horario, 'verificarHorarioVentanilla').mockResolvedValue(undefined);

  await limpiarDatosDePrueba();
  await prisma.caja.deleteMany({ where: { estado: 'ABIERTA' } });

  juan = await crearAsociadoDePrueba('Juan');

  const sufijo = sufijoUnico();
  const sucursal = await prisma.sucursal.findFirstOrThrow();

  const persona = await prisma.persona.create({
    data: {
      tipoDocumento: 'CC',
      numeroDocumento: `TEST-CAJ-${sufijo}`,
      nombres: 'Cajero',
      apellidos: 'De Prueba',
    },
  });
  personaCajeroId = persona.id;

  const empleado = await prisma.empleado.create({
    data: {
      personaId: persona.id,
      codigoEmpleado: `EMP-${sufijo}`,
      cargo: 'CAJERO',
      sucursalId: sucursal.id,
      fechaIngreso: new Date(),
      salarioFondo: 200_000_000n,
    },
  });

  const usuario = await prisma.usuario.create({
    data: {
      personaId: persona.id,
      correoAcceso: `cajero-${sufijo}@fondo.local`,
      hashContrasena: 'x',
    },
  });
  usuarioCajeroId = usuario.id;

  cajero = {
    id: usuario.id,
    personaId: persona.id,
    permisos: ['caja.abrir', 'caja.depositar', 'caja.retirar', 'caja.cerrar'],
    roles: ['CAJERO'],
    sucursalId: sucursal.id,
    esAdministrador: false,
    asociadoId: null,
    empleadoId: empleado.id,
  };

  const caja = await abrirCaja(cajero, 0n);
  cajaId = caja.id;
});

afterAll(async () => {
  await limpiarDatosDePrueba();
  await prisma.$disconnect();
});

describe('depósitos', () => {
  it('aumenta el saldo de la cuenta', async () => {
    await depositar(juan.ahorro.id, 50_000_000n, cajero);
    expect(await obtenerSaldo(juan.ahorro.id)).toBe(50_000_000n);
  });

  it('rechaza monto cero o negativo', async () => {
    await expect(depositar(juan.ahorro.id, 0n, cajero)).rejects.toThrow(ErrorNegocio);
    await expect(depositar(juan.ahorro.id, -100n, cajero)).rejects.toThrow(ErrorNegocio);
  });

  it('rechaza depósito en cuenta bloqueada', async () => {
    await prisma.cuenta.update({
      where: { id: juan.ahorro.id },
      data: { estado: 'BLOQUEADA' },
    });
    await expect(depositar(juan.ahorro.id, 10_000_000n, cajero)).rejects.toThrow(ErrorNegocio);
  });

  it('el libro sigue cuadrando', async () => {
    await depositar(juan.ahorro.id, 50_000_000n, cajero);
    await depositar(juan.aportes.id, 96_000_000n, cajero);

    const balance = await verificarBalanceGlobal();
    expect(balance.diferencia).toBe(0n);
  });
});

describe('retiros', () => {
  it('disminuye el saldo', async () => {
    await depositar(juan.ahorro.id, 50_000_000n, cajero);
    await retirar(juan.ahorro.id, 20_000_000n, cajero);

    expect(await obtenerSaldo(juan.ahorro.id)).toBe(30_000_000n);
  });

  it('rechaza retiro mayor al saldo', async () => {
    await depositar(juan.ahorro.id, 10_000_000n, cajero);
    await expect(retirar(juan.ahorro.id, 20_000_000n, cajero)).rejects.toThrow(ErrorNegocio);
  });

  it('no permite retirar de aportes sociales', async () => {
    await depositar(juan.aportes.id, 96_000_000n, cajero);
    await expect(retirar(juan.aportes.id, 10_000_000n, cajero)).rejects.toThrow(
      /aportes sociales/i,
    );
  });

  it('exige autorización sobre el tope de 15 millones', async () => {
    await depositar(juan.ahorro.id, 2_000_000_000n, cajero);

    await expect(retirar(juan.ahorro.id, 1_600_000_000n, cajero)).rejects.toThrow(
      /autorización/i,
    );
  });

  it('permite retirar justo en el tope sin autorización', async () => {
    await depositar(juan.ahorro.id, 2_000_000_000n, cajero);
    await retirar(juan.ahorro.id, 1_500_000_000n, cajero);

    expect(await obtenerSaldo(juan.ahorro.id)).toBe(500_000_000n);
  });

  it('rechaza si la caja no tiene efectivo suficiente', async () => {
    // El asociado tiene saldo, pero la caja no tiene los billetes
    await depositar(juan.ahorro.id, 10_000_000n, cajero);

    const sucursal = await prisma.sucursal.findFirstOrThrow();
    const planCuenta = await prisma.planCuentas.findFirstOrThrow({
      where: { sucursalId: sucursal.id, familia: 'ACTIVO' },
    });
    await prisma.saldoCachePlan.update({
      where: { planCuentaId: planCuenta.id },
      data: { saldo: 100n },
    });

    await expect(retirar(juan.ahorro.id, 10_000_000n, cajero)).rejects.toThrow(
      /efectivo/i,
    );
  });
});

describe('cierre de caja', () => {
  it('cuadra cuando lo contado coincide con el sistema', async () => {
    await depositar(juan.ahorro.id, 50_000_000n, cajero);

    const sucursal = await prisma.sucursal.findFirstOrThrow();
    const planCuenta = await prisma.planCuentas.findFirstOrThrow({
      where: { sucursalId: sucursal.id, familia: 'ACTIVO' },
    });
    const saldoSistema = (
      await prisma.saldoCachePlan.findUniqueOrThrow({
        where: { planCuentaId: planCuenta.id },
      })
    ).saldo;

    const caja = await cerrarCaja(cajaId, saldoSistema, cajero);

    expect(caja.estado).toBe('CUADRADA');
    expect(caja.diferencia).toBe(0n);
  });

  it('detecta descuadre', async () => {
    await depositar(juan.ahorro.id, 50_000_000n, cajero);

    const caja = await cerrarCaja(cajaId, 999n, cajero);

    expect(caja.estado).toBe('DESCUADRADA');
    expect(caja.diferencia).not.toBe(0n);
  });

  it('no permite operar con la caja cerrada', async () => {
    await cerrarCaja(cajaId, 0n, cajero);
    await expect(depositar(juan.ahorro.id, 10_000_000n, cajero)).rejects.toThrow(
      /caja/i,
    );
  });
});