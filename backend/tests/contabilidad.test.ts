import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/comun/prisma.js';
import {
  registrarTransaccion,
  obtenerSaldo,
  obtenerSaldoPlan,
  verificarBalanceGlobal,
} from '../src/modulos/contabilidad/contabilidad.servicio.js';
import {
  AsientosDesbalanceados,
  SaldoInsuficiente,
  TransaccionDuplicada,
  CuentaNoOperativa,
} from '../src/comun/errores.js';
import {
  crearAsociadoDePrueba,
  limpiarDatosDePrueba,
  cuentaPlan,
  usuarioCualquiera,
  sufijoUnico,
} from './ayudantes.js';

let juan: Awaited<ReturnType<typeof crearAsociadoDePrueba>>;
let caja: Awaited<ReturnType<typeof cuentaPlan>>;
let usuario: Awaited<ReturnType<typeof usuarioCualquiera>>;

beforeEach(async () => {
  await limpiarDatosDePrueba();
  juan = await crearAsociadoDePrueba('Juan');
  caja = await cuentaPlan('1105-1');
  usuario = await usuarioCualquiera();
});

afterAll(async () => {
  await limpiarDatosDePrueba();
  await prisma.$disconnect();
});

/** Atajo para depositar en una cuenta */
async function depositar(cuentaId: string, centavos: bigint) {
  return registrarTransaccion({
    tipo: 'DEPOSITO_VENTANILLA',
    creadoPorId: usuario.id,
    claveIdempotencia: `dep-${sufijoUnico()}`,
    lineas: [
      { planCuentaId: caja.id, monto: centavos },
      { cuentaId, monto: -centavos },
    ],
  });
}

describe('regla de suma cero', () => {
  it('acepta una transacción balanceada', async () => {
    const t = await depositar(juan.ahorro.id, 10_000_000n);
    expect(t.id).toBeDefined();
  });

  it('rechaza asientos que no suman cero', async () => {
    await expect(
      registrarTransaccion({
        tipo: 'DEPOSITO_VENTANILLA',
        creadoPorId: usuario.id,
        claveIdempotencia: `malo-${sufijoUnico()}`,
        lineas: [
          { planCuentaId: caja.id, monto: 10_000_000n },
          { cuentaId: juan.ahorro.id, monto: -9_000_000n },
        ],
      }),
    ).rejects.toThrow(AsientosDesbalanceados);
  });

  it('rechaza una transacción con una sola línea', async () => {
    await expect(
      registrarTransaccion({
        tipo: 'DEPOSITO_VENTANILLA',
        creadoPorId: usuario.id,
        claveIdempotencia: `sola-${sufijoUnico()}`,
        lineas: [{ planCuentaId: caja.id, monto: 10_000_000n }],
      }),
    ).rejects.toThrow(AsientosDesbalanceados);
  });

  it('acepta transacciones de tres o más líneas', async () => {
    const ingreso = await cuentaPlan('4135');

    // La afiliación de Juan: $50.000 de cuota + $960.000 de aporte
    const t = await registrarTransaccion({
      tipo: 'AFILIACION',
      creadoPorId: usuario.id,
      claveIdempotencia: `afi-${sufijoUnico()}`,
      lineas: [
        { planCuentaId: caja.id, monto: 101_000_000n },
        { planCuentaId: ingreso.id, monto: -5_000_000n },
        { cuentaId: juan.aportes.id, monto: -96_000_000n },
      ],
    });

    expect(t.id).toBeDefined();
    expect(await obtenerSaldo(juan.aportes.id)).toBe(96_000_000n);
  });

  it('no deja rastro cuando rechaza', async () => {
    const antes = await prisma.transaccion.count();

    await expect(
      registrarTransaccion({
        tipo: 'DEPOSITO_VENTANILLA',
        creadoPorId: usuario.id,
        claveIdempotencia: `sinrastro-${sufijoUnico()}`,
        lineas: [
          { planCuentaId: caja.id, monto: 10_000_000n },
          { cuentaId: juan.ahorro.id, monto: -1n },
        ],
      }),
    ).rejects.toThrow();

    expect(await prisma.transaccion.count()).toBe(antes);
  });
});

describe('cálculo de saldos', () => {
  it('el depósito aumenta el saldo', async () => {
    await depositar(juan.ahorro.id, 20_000_000n);
    expect(await obtenerSaldo(juan.ahorro.id)).toBe(20_000_000n);
  });

  it('el retiro disminuye el saldo', async () => {
    await depositar(juan.ahorro.id, 20_000_000n);

    await registrarTransaccion({
      tipo: 'RETIRO_VENTANILLA',
      creadoPorId: usuario.id,
      claveIdempotencia: `ret-${sufijoUnico()}`,
      lineas: [
        { cuentaId: juan.ahorro.id, monto: 3_000_000n },
        { planCuentaId: caja.id, monto: -3_000_000n },
      ],
    });

    expect(await obtenerSaldo(juan.ahorro.id)).toBe(17_000_000n);
  });

  it('los depósitos se acumulan', async () => {
    await depositar(juan.ahorro.id, 10_000_000n);
    await depositar(juan.ahorro.id, 5_000_000n);
    await depositar(juan.ahorro.id, 2_500_000n);

    expect(await obtenerSaldo(juan.ahorro.id)).toBe(17_500_000n);
  });

  it('la caja acumula el efectivo recibido', async () => {
    const saldoInicial = await obtenerSaldoPlan(caja.id);
    await depositar(juan.ahorro.id, 10_000_000n);

    expect(await obtenerSaldoPlan(caja.id)).toBe(saldoInicial + 10_000_000n);
  });

  it('las cuentas de un mismo asociado son independientes', async () => {
    await depositar(juan.ahorro.id, 10_000_000n);
    await depositar(juan.aportes.id, 96_000_000n);

    expect(await obtenerSaldo(juan.ahorro.id)).toBe(10_000_000n);
    expect(await obtenerSaldo(juan.aportes.id)).toBe(96_000_000n);
  });
});

describe('saldo nunca negativo', () => {
  it('rechaza un retiro mayor al saldo', async () => {
    await depositar(juan.ahorro.id, 10_000_000n);

    await expect(
      registrarTransaccion({
        tipo: 'RETIRO_VENTANILLA',
        creadoPorId: usuario.id,
        claveIdempotencia: `sobre-${sufijoUnico()}`,
        lineas: [
          { cuentaId: juan.ahorro.id, monto: 15_000_000n },
          { planCuentaId: caja.id, monto: -15_000_000n },
        ],
      }),
    ).rejects.toThrow(SaldoInsuficiente);
  });

  it('permite retirar exactamente todo el saldo', async () => {
    await depositar(juan.ahorro.id, 10_000_000n);

    await registrarTransaccion({
      tipo: 'RETIRO_VENTANILLA',
      creadoPorId: usuario.id,
      claveIdempotencia: `exacto-${sufijoUnico()}`,
      lineas: [
        { cuentaId: juan.ahorro.id, monto: 10_000_000n },
        { planCuentaId: caja.id, monto: -10_000_000n },
      ],
    });

    expect(await obtenerSaldo(juan.ahorro.id)).toBe(0n);
  });

  it('rechaza retirar de una cuenta vacía', async () => {
    await expect(
      registrarTransaccion({
        tipo: 'RETIRO_VENTANILLA',
        creadoPorId: usuario.id,
        claveIdempotencia: `vacia-${sufijoUnico()}`,
        lineas: [
          { cuentaId: juan.ahorro.id, monto: 1n },
          { planCuentaId: caja.id, monto: -1n },
        ],
      }),
    ).rejects.toThrow(SaldoInsuficiente);
  });

  it('el saldo no cambia cuando el retiro se rechaza', async () => {
    await depositar(juan.ahorro.id, 10_000_000n);

    await expect(
      registrarTransaccion({
        tipo: 'RETIRO_VENTANILLA',
        creadoPorId: usuario.id,
        claveIdempotencia: `rollback-${sufijoUnico()}`,
        lineas: [
          { cuentaId: juan.ahorro.id, monto: 99_000_000n },
          { planCuentaId: caja.id, monto: -99_000_000n },
        ],
      }),
    ).rejects.toThrow();

    expect(await obtenerSaldo(juan.ahorro.id)).toBe(10_000_000n);
  });
});

describe('idempotencia', () => {
  it('rechaza la misma clave dos veces', async () => {
    const clave = `unica-${sufijoUnico()}`;

    const lineas = [
      { planCuentaId: caja.id, monto: 10_000_000n },
      { cuentaId: juan.ahorro.id, monto: -10_000_000n },
    ];

    await registrarTransaccion({
      tipo: 'DEPOSITO_VENTANILLA',
      creadoPorId: usuario.id,
      claveIdempotencia: clave,
      lineas,
    });

    await expect(
      registrarTransaccion({
        tipo: 'DEPOSITO_VENTANILLA',
        creadoPorId: usuario.id,
        claveIdempotencia: clave,
        lineas,
      }),
    ).rejects.toThrow(TransaccionDuplicada);
  });

  it('el doble clic no duplica el dinero', async () => {
    const clave = `doble-${sufijoUnico()}`;
    const lineas = [
      { planCuentaId: caja.id, monto: 10_000_000n },
      { cuentaId: juan.ahorro.id, monto: -10_000_000n },
    ];

    await registrarTransaccion({
      tipo: 'DEPOSITO_VENTANILLA',
      creadoPorId: usuario.id,
      claveIdempotencia: clave,
      lineas,
    });

    await registrarTransaccion({
      tipo: 'DEPOSITO_VENTANILLA',
      creadoPorId: usuario.id,
      claveIdempotencia: clave,
      lineas,
    }).catch(() => {});

    // Solo se aplicó una vez
    expect(await obtenerSaldo(juan.ahorro.id)).toBe(10_000_000n);
  });
});

describe('cuentas no operativas', () => {
  it('rechaza movimientos sobre una cuenta bloqueada', async () => {
    await prisma.cuenta.update({
      where: { id: juan.ahorro.id },
      data: { estado: 'BLOQUEADA' },
    });

    await expect(depositar(juan.ahorro.id, 10_000_000n)).rejects.toThrow(
      CuentaNoOperativa,
    );
  });
});

describe('integridad global', () => {
  it('el sistema cuadra después de varias operaciones', async () => {
    const maria = await crearAsociadoDePrueba('Maria');
    const ingreso = await cuentaPlan('4135');

    await depositar(juan.ahorro.id, 20_000_000n);
    await depositar(maria.ahorro.id, 15_000_000n);

    await registrarTransaccion({
      tipo: 'AFILIACION',
      creadoPorId: usuario.id,
      claveIdempotencia: `glob-afi-${sufijoUnico()}`,
      lineas: [
        { planCuentaId: caja.id, monto: 101_000_000n },
        { planCuentaId: ingreso.id, monto: -5_000_000n },
        { cuentaId: juan.aportes.id, monto: -96_000_000n },
      ],
    });

    await registrarTransaccion({
      tipo: 'TRANSFERENCIA',
      creadoPorId: usuario.id,
      claveIdempotencia: `glob-tr-${sufijoUnico()}`,
      lineas: [
        { cuentaId: juan.ahorro.id, monto: 5_000_000n },
        { cuentaId: maria.ahorro.id, monto: -5_000_000n },
      ],
    });

    const balance = await verificarBalanceGlobal();
    expect(balance.diferencia).toBe(0n);
    expect(balance.balanceado).toBe(true);
  });

  it('una transferencia no crea ni destruye dinero', async () => {
    const maria = await crearAsociadoDePrueba('Maria');

    await depositar(juan.ahorro.id, 20_000_000n);
    const totalAntes =
      (await obtenerSaldo(juan.ahorro.id)) + (await obtenerSaldo(maria.ahorro.id));

    await registrarTransaccion({
      tipo: 'TRANSFERENCIA',
      creadoPorId: usuario.id,
      claveIdempotencia: `conserva-${sufijoUnico()}`,
      lineas: [
        { cuentaId: juan.ahorro.id, monto: 5_000_000n },
        { cuentaId: maria.ahorro.id, monto: -5_000_000n },
      ],
    });

    const totalDespues =
      (await obtenerSaldo(juan.ahorro.id)) + (await obtenerSaldo(maria.ahorro.id));

    expect(totalDespues).toBe(totalAntes);
  });
});