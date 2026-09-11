import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from '@node-rs/argon2';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Sembrando datos iniciales...');

  await sembrarParametros();
  await sembrarSucursales();
  await sembrarPlanCuentas();
  await sembrarRolesYPermisos();
  await sembrarAdministrador();
  await sembrarReloj();

  console.log('Semilla completada.');
}

main()
  .catch((e) => {
    console.error('Error en la semilla:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


  async function sembrarParametros() {
  const parametros = [
    // Afiliación y aportes
    { clave: 'afiliacion.cuota',              valor: '5000000',   tipo: 'MONTO',      descripcion: 'Cuota única de afiliación ($50.000)' },
    { clave: 'aporte.porcentaje_salario',     valor: '5',         tipo: 'PORCENTAJE', descripcion: 'Aporte social anual como % del salario anual' },
    { clave: 'aporte.piso',                   valor: '60000000',  tipo: 'MONTO',      descripcion: 'Aporte anual mínimo ($600.000)' },
    { clave: 'aporte.techo',                  valor: '300000000', tipo: 'MONTO',      descripcion: 'Aporte anual máximo ($3.000.000)' },

    // Créditos
    { clave: 'credito.cupo_multiplicador',    valor: '3',         tipo: 'ENTERO',     descripcion: 'Cupo = N veces los aportes acumulados' },
    { clave: 'credito.capacidad_pago_pct',    valor: '30',        tipo: 'PORCENTAJE', descripcion: 'Máximo % del salario destinable a cuotas' },
    { clave: 'credito.antiguedad_minima_meses', valor: '6',       tipo: 'ENTERO',     descripcion: 'Meses mínimos de afiliación para solicitar' },
    { clave: 'credito.tasa_mensual',          valor: '1.5',       tipo: 'DECIMAL',    descripcion: 'Tasa de interés mensual sobre saldo' },
    { clave: 'credito.tope_asesor',           valor: '300000000', tipo: 'MONTO',      descripcion: 'Monto máximo que aprueba un asesor ($3.000.000)' },
    { clave: 'credito.tope_gerente',          valor: '1200000000', tipo: 'MONTO',     descripcion: 'Monto máximo que aprueba un gerente ($12.000.000)' },
    { clave: 'credito.plazo_max_bajo',        valor: '24',        tipo: 'ENTERO',     descripcion: 'Plazo máximo en meses hasta $3.000.000' },
    { clave: 'credito.plazo_max_medio',       valor: '36',        tipo: 'ENTERO',     descripcion: 'Plazo máximo en meses hasta $12.000.000' },
    { clave: 'credito.plazo_max_alto',        valor: '60',        tipo: 'ENTERO',     descripcion: 'Plazo máximo en meses sobre $12.000.000' },

    // Mora
    { clave: 'mora.dias_gracia',              valor: '5',         tipo: 'ENTERO',     descripcion: 'Días de gracia tras el vencimiento' },
    { clave: 'mora.tasa_mensual',             valor: '2.0',       tipo: 'DECIMAL',    descripcion: 'Tasa de interés moratorio mensual' },
    { clave: 'mora.dias_bloqueo_solicitudes', valor: '30',        tipo: 'ENTERO',     descripcion: 'Días de mora que bloquean nuevas solicitudes' },
    { clave: 'mora.dias_prejuridico',         valor: '60',        tipo: 'ENTERO',     descripcion: 'Días de mora para pasar a cobro prejurídico' },
    { clave: 'mora.dias_cartera_vencida',     valor: '90',        tipo: 'ENTERO',     descripcion: 'Días de mora para marcar cartera vencida' },
    { clave: 'cuota.dia_vencimiento',         valor: '5',         tipo: 'ENTERO',     descripcion: 'Día del mes en que vencen las cuotas' },

    // Intereses de ahorro
    { clave: 'ahorro.tasa_anual',             valor: '6.0',       tipo: 'DECIMAL',    descripcion: 'Tasa anual del ahorro voluntario' },
    { clave: 'aportes.tasa_anual',            valor: '4.0',       tipo: 'DECIMAL',    descripcion: 'Tasa anual de los aportes sociales' },

    // Retiros y tarjeta
    { clave: 'retiro.tope_sin_autorizacion',  valor: '1500000000', tipo: 'MONTO',     descripcion: 'Retiro máximo sin visto bueno del gerente ($15.000.000)' },
    { clave: 'tarjeta.limite_diario',         valor: '200000000', tipo: 'MONTO',      descripcion: 'Límite diario de retiro en cajero ($2.000.000)' },
    { clave: 'tarjeta.vigencia_anios',        valor: '5',         tipo: 'ENTERO',     descripcion: 'Años de vigencia de una tarjeta' },

    // Horarios
    { clave: 'horario.ventanilla_inicio',     valor: '08:00',     tipo: 'HORA',       descripcion: 'Hora de apertura de ventanilla' },
    { clave: 'horario.ventanilla_fin',        valor: '16:00',     tipo: 'HORA',       descripcion: 'Hora de cierre de ventanilla entre semana' },
    { clave: 'horario.ventanilla_fin_sabado', valor: '12:00',     tipo: 'HORA',       descripcion: 'Hora de cierre de ventanilla los sábados' },

    // Seguridad
    { clave: 'seguridad.intentos_max',        valor: '5',         tipo: 'ENTERO',     descripcion: 'Intentos fallidos antes de bloquear la cuenta' },
    { clave: 'seguridad.minutos_bloqueo',     valor: '15',        tipo: 'ENTERO',     descripcion: 'Minutos de bloqueo tras superar los intentos' },
  ] as const;

  for (const p of parametros) {
    await prisma.parametro.upsert({
      where:  { clave: p.clave },
      update: { valor: p.valor, tipo: p.tipo as any, descripcion: p.descripcion },
      create: { clave: p.clave, valor: p.valor, tipo: p.tipo as any, descripcion: p.descripcion },
    });
  }

  console.log(`  ${parametros.length} parámetros`);
}


async function sembrarSucursales() {
  const sucursales = [
    { nombre: 'Sede Principal', ciudad: 'Medellín', direccion: 'Calle 50 # 40-20' },
    { nombre: 'Sede Norte',     ciudad: 'Medellín', direccion: 'Carrera 52 # 80-15' },
    { nombre: 'Sede Oriente',   ciudad: 'Rionegro', direccion: 'Calle 45 # 50-30' },
  ];

  for (const s of sucursales) {
    await prisma.sucursal.upsert({
      where:  { nombre: s.nombre },
      update: {},
      create: s,
    });
  }

  console.log(`  ${sucursales.length} sucursales`);
}

async function sembrarPlanCuentas() {
  const sucursales = await prisma.sucursal.findMany();

  // Cuentas globales del fondo
  const globales = [
    { codigo: '1305', nombre: 'Cartera de créditos',              familia: 'ACTIVO' },
    { codigo: '1310', nombre: 'Intereses de mora por cobrar',      familia: 'ACTIVO' },
    { codigo: '2405', nombre: 'Aportes por devolver',              familia: 'PASIVO' },
    { codigo: '3105', nombre: 'Excedentes acumulados',             familia: 'PATRIMONIO' },
    { codigo: '4135', nombre: 'Ingresos por cuotas de afiliación', familia: 'INGRESO' },
    { codigo: '4210', nombre: 'Ingresos por intereses de crédito', familia: 'INGRESO' },
    { codigo: '4215', nombre: 'Ingresos por intereses de mora',    familia: 'INGRESO' },
    { codigo: '5305', nombre: 'Gastos por intereses sobre ahorros', familia: 'GASTO' },
    { codigo: '1110', nombre: 'Bancos',                             familia: 'ACTIVO' },
  ] as const;

  for (const c of globales) {
    await prisma.planCuentas.upsert({
      where:  { codigo: c.codigo },
      update: {},
      create: { codigo: c.codigo, nombre: c.nombre, familia: c.familia as any },
    });
  }

  // Una caja por sucursal
  let indice = 1;
  for (const suc of sucursales) {
    const codigo = `1105-${indice}`;
    await prisma.planCuentas.upsert({
      where:  { codigo },
      update: {},
      create: {
        codigo,
        nombre: `Caja ${suc.nombre}`,
        familia: 'ACTIVO',
        sucursalId: suc.id,
      },
    });
    indice++;
  }

  const total = globales.length + sucursales.length;
  console.log(`  ${total} cuentas del plan contable`);
}


async function sembrarRolesYPermisos() {
  const permisos = [
    // Asociados
    'asociado.crear', 'asociado.editar', 'asociado.consultar', 'asociado.desafiliar',
    'salario.registrar',
    // Caja
    'caja.abrir', 'caja.cerrar', 'caja.depositar', 'caja.retirar', 'caja.autorizar_retiro',
    // Cuentas
    'cuenta.consultar', 'cuenta.bloquear', 'cuenta.transferir',
    // Créditos
    'credito.simular', 'credito.radicar', 'credito.consultar',
    'credito.aprobar.asesor', 'credito.aprobar.gerente', 'credito.aprobar.administrador',
    'credito.desembolsar', 'credito.pagar_cuota',
    // Tarjetas
    'tarjeta.emitir', 'tarjeta.bloquear',
    // Personal
    'empleado.crear', 'empleado.editar', 'empleado.desactivar',
    // Sistema
    'parametro.editar', 'reloj.modificar', 'proceso.ejecutar',
    'auditoria.consultar', 'reporte.consultar', 'reporte.consultar.global',
  ];

  for (const clave of permisos) {
    await prisma.permiso.upsert({
      where:  { clave },
      update: {},
      create: { clave },
    });
  }

  const roles: Record<string, string[]> = {
    ADMINISTRADOR: permisos, // todos

    GERENTE: [
      'asociado.consultar', 'cuenta.consultar', 'cuenta.bloquear',
      'caja.autorizar_retiro',
      'credito.consultar', 'credito.aprobar.gerente',
      'tarjeta.bloquear',
      'auditoria.consultar', 'reporte.consultar',
    ],

    ASESOR: [
      'asociado.crear', 'asociado.editar', 'asociado.consultar', 'asociado.desafiliar',
      'salario.registrar',
      'cuenta.consultar', 'tarjeta.emitir', 'tarjeta.bloquear',
      'credito.simular', 'credito.radicar', 'credito.consultar', 'credito.aprobar.asesor',
    ],

    CAJERO: [
      'asociado.consultar', 'cuenta.consultar',
      'caja.abrir', 'caja.cerrar', 'caja.depositar', 'caja.retirar',
      'credito.pagar_cuota',
    ],

    RRHH: [
      'empleado.crear', 'empleado.editar', 'empleado.desactivar',
    ],

    ASOCIADO: [
      'cuenta.consultar', 'cuenta.transferir',
      'credito.simular', 'credito.consultar',
      'tarjeta.bloquear',
    ],

    REVISOR_FISCAL: [
      'asociado.consultar', 'cuenta.consultar', 'credito.consultar',
      'auditoria.consultar', 'reporte.consultar', 'reporte.consultar.global',
    ],
  };

  for (const [nombre, claves] of Object.entries(roles)) {
    const rol = await prisma.rol.upsert({
      where:  { nombre },
      update: {},
      create: { nombre },
    });

    for (const clave of claves) {
      const permiso = await prisma.permiso.findUniqueOrThrow({ where: { clave } });
      await prisma.rolPermiso.upsert({
        where:  { rolId_permisoId: { rolId: rol.id, permisoId: permiso.id } },
        update: {},
        create: { rolId: rol.id, permisoId: permiso.id },
      });
    }
  }

  console.log(`  ${permisos.length} permisos, ${Object.keys(roles).length} roles`);
}


async function sembrarAdministrador() {
  const documento = '1000000001';

  const existe = await prisma.persona.findUnique({
    where: { numeroDocumento: documento },
  });
  if (existe) {
    console.log('  administrador ya existe');
    return;
  }

  const principal = await prisma.sucursal.findFirstOrThrow({
    where: { nombre: 'Sede Principal' },
  });

  const persona = await prisma.persona.create({
    data: {
      tipoDocumento: 'CC',
      numeroDocumento: documento,
      nombres: 'Admin',
      apellidos: 'del Fondo',
      correoPersonal: 'admin@fondo.local',
    },
  });

  await prisma.empleado.create({
    data: {
      personaId: persona.id,
      codigoEmpleado: 'EMP-0001',
      cargo: 'ADMINISTRADOR',
      sucursalId: principal.id,
      fechaIngreso: new Date('2026-01-01'),
      correoCorporativo: 'admin@fondo.local',
      salarioFondo: 800000000n, // $8.000.000
    },
  });

  const usuario = await prisma.usuario.create({
    data: {
      personaId: persona.id,
      correoAcceso: 'admin@fondo.local',
      hashContrasena: await hash('Admin2026*'),
    },
  });

  const rolAdmin = await prisma.rol.findUniqueOrThrow({
    where: { nombre: 'ADMINISTRADOR' },
  });

  await prisma.usuarioRol.create({
    data: { usuarioId: usuario.id, rolId: rolAdmin.id },
  });

  console.log('  administrador creado (admin@fondo.local / Admin2026*)');
}

async function sembrarReloj() {
  await prisma.relojSistema.upsert({
    where:  { id: 1 },
    update: {},
    create: { id: 1, modo: 'REAL' },
  });

  console.log('  reloj del sistema');
}