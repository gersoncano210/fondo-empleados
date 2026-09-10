import { prisma } from '../comun/prisma.js';
import { formatearPesos } from '../comun/dinero.js';
import {
  registrarTransaccion,
  obtenerSaldo,
  obtenerSaldoPlan,
  verificarBalanceGlobal,
} from '../modulos/contabilidad/contabilidad.servicio.js';

async function main() {
  // --- Preparación: un asociado de prueba con sus dos cuentas ---

  const sucursal = await prisma.sucursal.findFirstOrThrow({
    where: { nombre: 'Sede Principal' },
  });
  const admin = await prisma.usuario.findFirstOrThrow();
  const cajaPrincipal = await prisma.planCuentas.findFirstOrThrow({
    where: { codigo: '1105-1' },
  });
  const ingresoAfiliacion = await prisma.planCuentas.findFirstOrThrow({
    where: { codigo: '4135' },
  });

  const persona = await prisma.persona.upsert({
    where: { numeroDocumento: '9999999901' },
    update: {},
    create: {
      tipoDocumento: 'CC',
      numeroDocumento: '9999999901',
      nombres: 'Juan',
      apellidos: 'Pérez',
    },
  });

  const juan = await prisma.asociado.upsert({
    where: { personaId: persona.id },
    update: {},
    create: {
      personaId: persona.id,
      numeroAsociado: 'ASO-9901',
      sucursalId: sucursal.id,
      fechaAfiliacion: new Date('2026-01-15'),
      cargoEmpresa: 'Docente',
    },
  });

  const aportes = await prisma.cuenta.upsert({
    where: { asociadoId_tipo: { asociadoId: juan.id, tipo: 'APORTES_SOCIALES' } },
    update: {},
    create: {
      asociadoId: juan.id,
      tipo: 'APORTES_SOCIALES',
      numero: 'APO-9901',
      fechaApertura: new Date('2026-01-15'),
    },
  });

  const ahorro = await prisma.cuenta.upsert({
    where: { asociadoId_tipo: { asociadoId: juan.id, tipo: 'AHORRO_VOLUNTARIO' } },
    update: {},
    create: {
      asociadoId: juan.id,
      tipo: 'AHORRO_VOLUNTARIO',
      numero: 'AHO-9901',
      fechaApertura: new Date('2026-01-15'),
    },
  });

  const marca = Date.now();

  // --- Movimiento 1: afiliación ($50.000 + $960.000 de aporte) ---

  console.log('\n--- Movimiento 1: afiliación de Juan ---');
  await registrarTransaccion({
    tipo: 'AFILIACION',
    descripcion: 'Vinculación de Juan Pérez',
    creadoPorId: admin.id,
    sucursalId: sucursal.id,
    claveIdempotencia: `afiliacion-${marca}`,
    lineas: [
      { planCuentaId: cajaPrincipal.id,     monto:  101_000_000n },
      { planCuentaId: ingresoAfiliacion.id, monto:   -5_000_000n },
      { cuentaId:     aportes.id,           monto:  -96_000_000n },
    ],
  });
  await mostrarSaldos();

  // --- Movimiento 2: abre ahorro voluntario con $200.000 ---

  console.log('\n--- Movimiento 2: depósito de $200.000 ---');
  await registrarTransaccion({
    tipo: 'DEPOSITO_VENTANILLA',
    descripcion: 'Apertura de ahorro voluntario',
    creadoPorId: admin.id,
    sucursalId: sucursal.id,
    claveIdempotencia: `deposito-${marca}`,
    lineas: [
      { planCuentaId: cajaPrincipal.id, monto:  20_000_000n },
      { cuentaId:     ahorro.id,        monto: -20_000_000n },
    ],
  });
  await mostrarSaldos();

  // --- Movimiento 5: retira $30.000 ---

  console.log('\n--- Movimiento 5: retiro de $30.000 ---');
  await registrarTransaccion({
    tipo: 'RETIRO_VENTANILLA',
    descripcion: 'Retiro en ventanilla',
    creadoPorId: admin.id,
    sucursalId: sucursal.id,
    claveIdempotencia: `retiro-${marca}`,
    lineas: [
      { cuentaId:     ahorro.id,        monto:   3_000_000n },
      { planCuentaId: cajaPrincipal.id, monto:  -3_000_000n },
    ],
  });
  await mostrarSaldos();

  // --- Prueba 1: asientos que no suman cero ---

  console.log('\n--- Prueba: asientos desbalanceados ---');
  try {
    await registrarTransaccion({
      tipo: 'DEPOSITO_VENTANILLA',
      creadoPorId: admin.id,
      claveIdempotencia: `malo-${marca}`,
      lineas: [
        { planCuentaId: cajaPrincipal.id, monto:  10_000_000n },
        { cuentaId:     ahorro.id,        monto:  -9_000_000n },
      ],
    });
    console.log('  FALLO: debió rechazarse');
  } catch (e: any) {
    console.log(`  Rechazado correctamente: ${e.message}`);
  }

  // --- Prueba 2: retiro mayor al saldo ---

  console.log('\n--- Prueba: saldo insuficiente ---');
  try {
    await registrarTransaccion({
      tipo: 'RETIRO_VENTANILLA',
      creadoPorId: admin.id,
      claveIdempotencia: `sobregiro-${marca}`,
      lineas: [
        { cuentaId:     ahorro.id,        monto:  50_000_000n },
        { planCuentaId: cajaPrincipal.id, monto: -50_000_000n },
      ],
    });
    console.log('  FALLO: debió rechazarse');
  } catch (e: any) {
    console.log(`  Rechazado correctamente: ${e.message}`);
  }

  // --- Prueba 3: idempotencia ---

  console.log('\n--- Prueba: transacción duplicada ---');
  try {
    await registrarTransaccion({
      tipo: 'DEPOSITO_VENTANILLA',
      creadoPorId: admin.id,
      claveIdempotencia: `deposito-${marca}`,
      lineas: [
        { planCuentaId: cajaPrincipal.id, monto:  20_000_000n },
        { cuentaId:     ahorro.id,        monto: -20_000_000n },
      ],
    });
    console.log('  FALLO: debió rechazarse');
  } catch (e: any) {
    console.log(`  Rechazado correctamente: ${e.message}`);
  }

  // --- Verificación global ---

  console.log('\n--- Balance global del sistema ---');
  const balance = await verificarBalanceGlobal();
  console.log(`  Suma de todos los asientos: ${balance.diferencia}`);
  console.log(`  ${balance.balanceado ? 'BALANCEADO' : 'DESCUADRADO'}`);

  async function mostrarSaldos() {
    console.log(`  Aportes de Juan:  ${formatearPesos(await obtenerSaldo(aportes.id))}`);
    console.log(`  Ahorro de Juan:   ${formatearPesos(await obtenerSaldo(ahorro.id))}`);
    console.log(`  Caja Principal:   ${formatearPesos(await obtenerSaldoPlan(cajaPrincipal.id))}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());