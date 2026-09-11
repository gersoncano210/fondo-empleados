import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/comun/prisma.js';
import {
  transferir,
  pagoSimulado,
  movimientosDeCuenta,
} from '../src/modulos/transferencias/transferencias.servicio.js';
import {
  obtenerSaldo,
  obtenerSaldoPlan,
  registrarTransaccion,
  verificarBalanceGlobal,
} from '../src/modulos/contabilidad/contabilidad.servicio.js';
import { ErrorNegocio } from '../src/comun/errores.js';
import {
  crearAsociadoDePrueba,
  limpiarDatosDePrueba,
  cuentaPlan,
  usuarioCualquiera,
  sufijoUnico,
} from './ayudantes.js';
import type { UsuarioAutenticado } from '../src/modulos/auth/auth.middleware.js';

let juan: Awaited<ReturnType<typeof crearAsociadoDePrueba>>;
let maria: Awaited<ReturnType<typeof crearAsociadoDePrueba>>;
let admin: UsuarioAutenticado;
let actorJuan: UsuarioAutenticado;

/** Mete plata inicial a una cuenta sin pasar por ventanilla */
async function fondear(cuentaId: string, monto: bigint, usuarioId: string) {
  const caja = await cuentaPlan('1105-1');
  await registrarTransaccion({
    tipo: 'DEPOSITO_VENTANILLA',
    creadoPorId: usuarioId,
    claveIdempotencia: `fondeo-${sufijoUnico()}`,
    lineas: [
      { planCuentaId: caja.id, monto },
      { cuentaId, monto: -monto },
    ] as any,
  });
}

beforeEach(async () => {
  await limpiarDatosDePrueba();

  juan = await crearAsociadoDePrueba('Juan');
  maria = await crearAsociadoDePrueba('Maria');

  const usuario = await usuarioCualquiera();

  admin = {
    id: usuario.id,
    personaId: usuario.personaId,
    permisos: ['cuenta.transferir', 'cuenta.consultar'],
    roles: ['ADMINISTRADOR'],
    sucursalId: juan.asociado.sucursalId,
    esAdministrador: true,
    asociadoId: null,
    empleadoId: null,
  };

  actorJuan = {
    ...admin,
    esAdministrador: false,
    asociadoId: juan.asociado.id,
    empleadoId: null,
    roles: ['ASOCIADO'],
  };

  await fondear(juan.ahorro.id, 50_000_000n, usuario.id);
});

afterAll(async () => {
  await limpiarDatosDePrueba();
  await prisma.$disconnect();
});

describe('transferencias entre asociados', () => {
  it('mueve el dinero de una cuenta a otra', async () => {
    await transferir(juan.ahorro.id, maria.ahorro.id, 20_000_000n, admin);

    expect(await obtenerSaldo(juan.ahorro.id)).toBe(30_000_000n);
    expect(await obtenerSaldo(maria.ahorro.id)).toBe(20_000_000n);
  });

  it('no crea ni destruye dinero', async () => {
    const antes =
      (await obtenerSaldo(juan.ahorro.id)) + (await obtenerSaldo(maria.ahorro.id));

    await transferir(juan.ahorro.id, maria.ahorro.id, 15_000_000n, admin);

    const despues =
      (await obtenerSaldo(juan.ahorro.id)) + (await obtenerSaldo(maria.ahorro.id));

    expect(despues).toBe(antes);
  });

  it('rechaza transferir más de lo que hay', async () => {
    await expect(
      transferir(juan.ahorro.id, maria.ahorro.id, 99_000_000n, admin),
    ).rejects.toThrow(ErrorNegocio);
  });

  it('rechaza transferir a la misma cuenta', async () => {
    await expect(
      transferir(juan.ahorro.id, juan.ahorro.id, 1_000_000n, admin),
    ).rejects.toMatchObject({ codigo: 'CUENTAS_IGUALES' });
  });

  it('rechaza monto cero o negativo', async () => {
    await expect(
      transferir(juan.ahorro.id, maria.ahorro.id, 0n, admin),
    ).rejects.toThrow(ErrorNegocio);
  });

  it('no permite transferir desde aportes sociales', async () => {
    await expect(
      transferir(juan.aportes.id, maria.ahorro.id, 1_000_000n, admin),
    ).rejects.toMatchObject({ codigo: 'TIPO_CUENTA_INVALIDO' });
  });

  it('no permite transferir hacia aportes sociales', async () => {
    await expect(
      transferir(juan.ahorro.id, maria.aportes.id, 1_000_000n, admin),
    ).rejects.toMatchObject({ codigo: 'TIPO_CUENTA_INVALIDO' });
  });

  it('rechaza si la cuenta origen está bloqueada', async () => {
    await prisma.cuenta.update({
      where: { id: juan.ahorro.id },
      data: { estado: 'BLOQUEADA' },
    });

    await expect(
      transferir(juan.ahorro.id, maria.ahorro.id, 1_000_000n, admin),
    ).rejects.toThrow(ErrorNegocio);
  });

 it('rechaza si el asociado destino está retirado', async () => {
    await prisma.asociado.update({
      where: { id: maria.asociado.id },
      data: { estado: 'RETIRADO' },
    });

    await expect(
      transferir(juan.ahorro.id, maria.ahorro.id, 1_000_000n, admin),
        ).rejects.toMatchObject({ codigo: 'ASOCIADO_RETIRADO' });
  });

  it('el libro global sigue cuadrando', async () => {
    await transferir(juan.ahorro.id, maria.ahorro.id, 10_000_000n, admin);
    await transferir(maria.ahorro.id, juan.ahorro.id, 3_000_000n, admin);

    const balance = await verificarBalanceGlobal();
    expect(balance.diferencia).toBe(0n);
  });
});

describe('cuenta propia', () => {
  it('un asociado puede transferir desde su cuenta', async () => {
    await transferir(juan.ahorro.id, maria.ahorro.id, 5_000_000n, actorJuan);
    expect(await obtenerSaldo(maria.ahorro.id)).toBe(5_000_000n);
  });

  it('un asociado no puede transferir desde una cuenta ajena', async () => {
    await fondear(maria.ahorro.id, 10_000_000n, admin.id);

    await expect(
      transferir(maria.ahorro.id, juan.ahorro.id, 1_000_000n, actorJuan),
    ).rejects.toMatchObject({ codigo: 'CUENTA_AJENA' });
  });
});

describe('pago simulado', () => {
  it('ingresa dinero desde la cuenta de Bancos', async () => {
    const bancos = await cuentaPlan('1110');
    const saldoBancosAntes = await obtenerSaldoPlan(bancos.id);

    await pagoSimulado(juan.aportes.id, 150_000_000n, admin, 'Aporte anual');

    expect(await obtenerSaldo(juan.aportes.id)).toBe(150_000_000n);
    expect(await obtenerSaldoPlan(bancos.id)).toBe(saldoBancosAntes + 150_000_000n);
  });

  it('no toca la caja física', async () => {
    const caja = await cuentaPlan('1105-1');
    const saldoCajaAntes = await obtenerSaldoPlan(caja.id);

    await pagoSimulado(juan.ahorro.id, 20_000_000n, admin, 'Abono');

    expect(await obtenerSaldoPlan(caja.id)).toBe(saldoCajaAntes);
  });

  it('el libro cuadra tras el pago', async () => {
    await pagoSimulado(juan.aportes.id, 96_000_000n, admin, 'Aporte anual');

    const balance = await verificarBalanceGlobal();
    expect(balance.diferencia).toBe(0n);
  });

  it('un asociado no puede pagar a una cuenta ajena', async () => {
    await expect(
      pagoSimulado(maria.ahorro.id, 1_000_000n, actorJuan, 'Intento'),
    ).rejects.toMatchObject({ codigo: 'CUENTA_AJENA' });
  });
});

describe('extracto de movimientos', () => {
  it('muestra los depósitos en positivo', async () => {
    const movimientos = await movimientosDeCuenta(juan.ahorro.id, admin);

    expect(movimientos.length).toBeGreaterThan(0);
    expect(movimientos[0]!.monto).toBe(50_000_000n);
  });

  it('muestra las salidas en negativo', async () => {
    await transferir(juan.ahorro.id, maria.ahorro.id, 10_000_000n, admin);

    const movimientos = await movimientosDeCuenta(juan.ahorro.id, admin);
    const salida = movimientos.find((m) => m.tipo === 'TRANSFERENCIA');

    expect(salida!.monto).toBe(-10_000_000n);
  });

  it('un asociado no ve movimientos de cuentas ajenas', async () => {
    await expect(
      movimientosDeCuenta(maria.ahorro.id, actorJuan),
    ).rejects.toMatchObject({ codigo: 'ACCESO_NO_AUTORIZADO' });
  });
});