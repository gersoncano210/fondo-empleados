import { prisma } from '../src/comun/prisma.js';

/** Identificador único para que cada prueba use datos propios */
export function sufijoUnico(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/** Crea un asociado con sus dos cuentas, listo para mover plata */
export async function crearAsociadoDePrueba(nombre = 'Prueba') {
  const sufijo = sufijoUnico();

  const sucursal = await prisma.sucursal.findFirstOrThrow();

  const persona = await prisma.persona.create({
    data: {
      tipoDocumento: 'CC',
      numeroDocumento: `TEST-${sufijo}`,
      nombres: nombre,
      apellidos: 'De Prueba',
    },
  });

  const asociado = await prisma.asociado.create({
    data: {
      personaId: persona.id,
      numeroAsociado: `ASO-${sufijo}`,
      sucursalId: sucursal.id,
      fechaAfiliacion: new Date(),
    },
  });

  const aportes = await prisma.cuenta.create({
    data: {
      asociadoId: asociado.id,
      tipo: 'APORTES_SOCIALES',
      numero: `APO-${sufijo}`,
      fechaApertura: new Date(),
    },
  });

  const ahorro = await prisma.cuenta.create({
    data: {
      asociadoId: asociado.id,
      tipo: 'AHORRO_VOLUNTARIO',
      numero: `AHO-${sufijo}`,
      fechaApertura: new Date(),
    },
  });

  return { persona, asociado, aportes, ahorro };
}

/** Borra todo lo creado por las pruebas, respetando el orden de dependencias */
export async function limpiarDatosDePrueba() {
  const personas = await prisma.persona.findMany({
    where: { numeroDocumento: { startsWith: 'TEST-' } },
    select: { id: true },
  });
  if (personas.length === 0) return;

  const ids = personas.map((p) => p.id);

  const asociados = await prisma.asociado.findMany({
    where: { personaId: { in: ids } },
    select: { id: true },
  });
  const asociadoIds = asociados.map((a) => a.id);

  const empleados = await prisma.empleado.findMany({
    where: { personaId: { in: ids } },
    select: { id: true },
  });
  const empleadoIds = empleados.map((e) => e.id);

  const usuarios = await prisma.usuario.findMany({
    where: { personaId: { in: ids } },
    select: { id: true },
  });
  const usuarioIds = usuarios.map((u) => u.id);

  const cuentas = await prisma.cuenta.findMany({
    where: { asociadoId: { in: asociadoIds } },
    select: { id: true },
  });
  const cuentaIds = cuentas.map((c) => c.id);

  // Transacciones tocadas por estas cuentas o creadas por estos usuarios
  const asientos = await prisma.asiento.findMany({
    where: { cuentaId: { in: cuentaIds } },
    select: { transaccionId: true },
  });
  const porUsuario = await prisma.transaccion.findMany({
    where: { creadoPorId: { in: usuarioIds } },
    select: { id: true },
  });
  const transaccionIds = [
    ...new Set([
      ...asientos.map((a) => a.transaccionId),
      ...porUsuario.map((t) => t.id),
    ]),
  ];

  // De las hojas hacia la raíz
  await prisma.retiroCajero.deleteMany({ where: { transaccionId: { in: transaccionIds } } });
  await prisma.mora.deleteMany({ where: { transaccionId: { in: transaccionIds } } });
  await prisma.asiento.deleteMany({ where: { transaccionId: { in: transaccionIds } } });
  await prisma.transaccion.deleteMany({ where: { id: { in: transaccionIds } } });

  await prisma.caja.deleteMany({ where: { cajeroId: { in: empleadoIds } } });

  await prisma.tarjeta.deleteMany({ where: { cuentaId: { in: cuentaIds } } });
  await prisma.saldoCache.deleteMany({ where: { cuentaId: { in: cuentaIds } } });
  await prisma.cuenta.deleteMany({ where: { id: { in: cuentaIds } } });

  await prisma.salarioAsociado.deleteMany({ where: { asociadoId: { in: asociadoIds } } });
  await prisma.asociado.deleteMany({ where: { id: { in: asociadoIds } } });

  await prisma.tokenRefresco.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
  await prisma.usuarioRol.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
  await prisma.usuario.deleteMany({ where: { id: { in: usuarioIds } } });

  await prisma.empleado.deleteMany({ where: { id: { in: empleadoIds } } });
  await prisma.persona.deleteMany({ where: { id: { in: ids } } });
}

/** Obtiene una cuenta del plan por su código */
export async function cuentaPlan(codigo: string) {
  return prisma.planCuentas.findFirstOrThrow({ where: { codigo } });
}

/** Cualquier usuario, para usar como autor de las transacciones */
export async function usuarioCualquiera() {
  return prisma.usuario.findFirstOrThrow();
}