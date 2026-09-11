import { prisma } from '../../comun/prisma.js';
import { ahora, hoy } from '../../comun/reloj.js';
import { ErrorNegocio } from '../../comun/errores.js';
import {
  obtenerParametroMonto,
  obtenerParametroEntero,
} from '../../comun/parametros.js';
import { aplicarPorcentaje } from '../../comun/dinero.js';
import { registrarTransaccion } from '../contabilidad/contabilidad.servicio.js';
import { hashearContrasena } from '../auth/auth.servicio.js';
import type { DatosVinculacion } from './asociados.tipos.js';
import type { UsuarioAutenticado } from '../auth/auth.middleware.js';
import { filtroSucursal, verificarAccesoASucursal } from '../../comun/alcance.js';

/**
 * Vincula un nuevo asociado al fondo.
 *
 * Crea persona, asociado, usuario y sus dos cuentas, y cobra la
 * cuota de afiliación en ventanilla. Todo o nada.
 */
export async function vincularAsociado(
  datos: DatosVinculacion,
  actor: UsuarioAutenticado,
) {
  verificarAccesoASucursal(actor, datos.sucursalId);

  await verificarDocumentoLibre(datos.numeroDocumento);
  await verificarCorreoLibre(datos.correoAcceso);

  const fecha = await hoy();
  const cuotaAfiliacion = await obtenerParametroMonto('afiliacion.cuota');
  const aporteInicial = await calcularAporteAnual(datos.salarioMensual);

  const hash = await hashearContrasena(datos.contrasenaInicial);
  const numeroAsociado = await siguienteNumeroAsociado();

  // Fase 1: crear las entidades
  const creado = await prisma.$transaction(async (tx) => {
    const persona = await tx.persona.create({
      data: {
        tipoDocumento: datos.tipoDocumento,
        numeroDocumento: datos.numeroDocumento.trim(),
        nombres: datos.nombres.trim(),
        apellidos: datos.apellidos.trim(),
        fechaNacimiento: datos.fechaNacimiento,
        direccion: datos.direccion,
        telefono: datos.telefono,
        correoPersonal: datos.correoPersonal,
        contactoEmergenciaNombre: datos.contactoEmergenciaNombre,
        contactoEmergenciaTelefono: datos.contactoEmergenciaTelefono,
      },
    });

    const asociado = await tx.asociado.create({
      data: {
        personaId: persona.id,
        numeroAsociado,
        sucursalId: datos.sucursalId,
        asesorAsignadoId: datos.asesorAsignadoId ?? actor.empleadoId,
        fechaAfiliacion: fecha,
        cargoEmpresa: datos.cargoEmpresa,
      },
    });

    const usuario = await tx.usuario.create({
      data: {
        personaId: persona.id,
        correoAcceso: datos.correoAcceso.toLowerCase().trim(),
        hashContrasena: hash,
      },
    });

    const rolAsociado = await tx.rol.findUniqueOrThrow({
      where: { nombre: 'ASOCIADO' },
    });
    await tx.usuarioRol.create({
      data: { usuarioId: usuario.id, rolId: rolAsociado.id },
    });

    const cuentaAportes = await tx.cuenta.create({
      data: {
        asociadoId: asociado.id,
        tipo: 'APORTES_SOCIALES',
        numero: `APO-${numeroAsociado}`,
        fechaApertura: fecha,
      },
    });

    const cuentaAhorro = await tx.cuenta.create({
      data: {
        asociadoId: asociado.id,
        tipo: 'AHORRO_VOLUNTARIO',
        numero: `AHO-${numeroAsociado}`,
        fechaApertura: fecha,
      },
    });

    await tx.salarioAsociado.create({
      data: {
        asociadoId: asociado.id,
        valor: datos.salarioMensual,
        fechaVigencia: fecha,
        registradoPorId: actor.id,
        soporte: 'Certificado laboral de vinculación',
      },
    });

    return { persona, asociado, usuario, cuentaAportes, cuentaAhorro };
  });

  // Fase 2: cobrar en ventanilla (pasa por el servicio de contabilidad)
  const caja = await obtenerCuentaDeCaja(datos.cajaId);
  const ingresoAfiliacion = await prisma.planCuentas.findFirstOrThrow({
    where: { codigo: '4135' },
  });

  const lineas: Array<{ cuentaId?: string; planCuentaId?: string; monto: bigint }> = [];
  let totalRecibido = cuotaAfiliacion;

  lineas.push({ planCuentaId: ingresoAfiliacion.id, monto: -cuotaAfiliacion });

  if (datos.pagaAporteInicial) {
    totalRecibido += aporteInicial;
    lineas.push({ cuentaId: creado.cuentaAportes.id, monto: -aporteInicial });
  }

  lineas.unshift({ planCuentaId: caja.planCuentaId, monto: totalRecibido });

  await registrarTransaccion({
    tipo: 'AFILIACION',
    descripcion: `Vinculación de ${datos.nombres} ${datos.apellidos}`,
    creadoPorId: actor.id,
    sucursalId: datos.sucursalId,
    cajaId: datos.cajaId,
    claveIdempotencia: `afiliacion-${creado.asociado.id}`,
    lineas: lineas as any,
  });

  return {
    asociadoId: creado.asociado.id,
    numeroAsociado,
    cuotaAfiliacion,
    aporteInicial: datos.pagaAporteInicial ? aporteInicial : 0n,
    totalRecibido,
  };
}

/** Aporte social anual: 5% del salario anual, con piso y techo */
export async function calcularAporteAnual(salarioMensual: bigint): Promise<bigint> {
  const porcentaje = await obtenerParametroEntero('aporte.porcentaje_salario');
  const piso = await obtenerParametroMonto('aporte.piso');
  const techo = await obtenerParametroMonto('aporte.techo');

  const salarioAnual = salarioMensual * 12n;
  const calculado = aplicarPorcentaje(salarioAnual, porcentaje);

  if (calculado < piso) return piso;
  if (calculado > techo) return techo;
  return calculado;
}

async function verificarDocumentoLibre(documento: string): Promise<void> {
  const existe = await prisma.persona.findUnique({
    where: { numeroDocumento: documento.trim() },
    include: { asociado: true },
  });

  if (existe?.asociado) {
    throw new ErrorNegocio(
      `El documento ${documento} ya está afiliado al fondo`,
      'ASOCIADO_DUPLICADO',
      409,
    );
  }

  if (existe) {
    throw new ErrorNegocio(
      `Ya existe una persona con documento ${documento}. Use la vinculación de persona existente.`,
      'PERSONA_EXISTENTE',
      409,
    );
  }
}

async function verificarCorreoLibre(correo: string): Promise<void> {
  const existe = await prisma.usuario.findUnique({
    where: { correoAcceso: correo.toLowerCase().trim() },
  });

  if (existe) {
    throw new ErrorNegocio('El correo de acceso ya está en uso', 'CORREO_EN_USO', 409);
  }
}

async function siguienteNumeroAsociado(): Promise<string> {
  const ultimo = await prisma.asociado.findFirst({
    orderBy: { numeroAsociado: 'desc' },
    select: { numeroAsociado: true },
  });

  const numero = ultimo ? Number.parseInt(ultimo.numeroAsociado.slice(4), 10) + 1 : 1;
  return `ASO-${String(numero).padStart(6, '0')}`;
}

async function obtenerCuentaDeCaja(cajaId: string) {
  const caja = await prisma.caja.findUniqueOrThrow({
    where: { id: cajaId },
    include: { sucursal: true },
  });

  if (caja.estado !== 'ABIERTA') {
    throw new ErrorNegocio('La caja no está abierta', 'CAJA_CERRADA', 409);
  }

  const planCuenta = await prisma.planCuentas.findFirstOrThrow({
    where: { sucursalId: caja.sucursalId, familia: 'ACTIVO' },
  });

  return { cajaId: caja.id, planCuentaId: planCuenta.id };
}


// ============================================================
// CONSULTAS
// ============================================================

/** Lista asociados, respetando el alcance de sucursal del usuario */
export async function listarAsociados(
  actor: UsuarioAutenticado,
  opciones: { busqueda?: string; estado?: 'ACTIVO' | 'RETIRADO'; pagina?: number } = {},
) {
  const porPagina = 20;
  const pagina = opciones.pagina ?? 1;

  const where: any = {
    ...filtroSucursal(actor),
    ...(opciones.estado ? { estado: opciones.estado } : {}),
  };

  if (opciones.busqueda?.trim()) {
    const texto = opciones.busqueda.trim();
    where.OR = [
      { numeroAsociado: { contains: texto, mode: 'insensitive' } },
      { persona: { numeroDocumento: { contains: texto } } },
      { persona: { nombres: { contains: texto, mode: 'insensitive' } } },
      { persona: { apellidos: { contains: texto, mode: 'insensitive' } } },
    ];
  }

  const [total, asociados] = await Promise.all([
    prisma.asociado.count({ where }),
    prisma.asociado.findMany({
      where,
      include: {
        persona: {
          select: { nombres: true, apellidos: true, numeroDocumento: true, telefono: true },
        },
        sucursal: { select: { nombre: true } },
      },
      orderBy: { fechaAfiliacion: 'desc' },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
  ]);

  return {
    total,
    pagina,
    paginas: Math.ceil(total / porPagina),
    asociados,
  };
}

/** Ficha completa de un asociado, con saldos y salario vigente */
export async function obtenerAsociado(asociadoId: string, actor: UsuarioAutenticado) {
  const asociado = await prisma.asociado.findFirstOrThrow({
    where: { id: asociadoId, ...filtroSucursal(actor) },
    include: {
      persona: true,
      sucursal: { select: { id: true, nombre: true, ciudad: true } },
      asesorAsignado: {
        include: { persona: { select: { nombres: true, apellidos: true } } },
      },
      cuentas: {
        include: { saldoCache: true },
        orderBy: { tipo: 'asc' },
      },
      salarios: { orderBy: { fechaVigencia: 'desc' }, take: 1 },
    },
  });

  const mesesAfiliado = await calcularMesesAfiliado(asociado.fechaAfiliacion);

  return {
    ...asociado,
    salarioVigente: asociado.salarios[0]?.valor ?? 0n,
    mesesAfiliado,
    saldos: asociado.cuentas.map((c) => ({
      cuentaId: c.id,
      tipo: c.tipo,
      numero: c.numero,
      estado: c.estado,
      saldo: c.saldoCache?.saldo ?? 0n,
    })),
  };
}

/** Historial de cambios de salario */
export async function historialSalarios(asociadoId: string, actor: UsuarioAutenticado) {
  await prisma.asociado.findFirstOrThrow({
    where: { id: asociadoId, ...filtroSucursal(actor) },
  });

  return prisma.salarioAsociado.findMany({
    where: { asociadoId },
    include: {
      registradoPor: {
        include: { persona: { select: { nombres: true, apellidos: true } } },
      },
    },
    orderBy: { fechaVigencia: 'desc' },
  });
}

async function calcularMesesAfiliado(fechaAfiliacion: Date): Promise<number> {
  const actual = await hoy();
  const meses =
    (actual.getFullYear() - fechaAfiliacion.getFullYear()) * 12 +
    (actual.getMonth() - fechaAfiliacion.getMonth());
  return Math.max(0, meses);
}

// ============================================================
// SALARIO
// ============================================================

/**
 * Registra un nuevo salario. No sobrescribe: agrega al historial.
 * El salario vigente es siempre la fila más reciente.
 */
export async function registrarSalario(
  asociadoId: string,
  valor: bigint,
  soporte: string,
  actor: UsuarioAutenticado,
) {
  const asociado = await prisma.asociado.findFirstOrThrow({
    where: { id: asociadoId, ...filtroSucursal(actor) },
    include: { salarios: { orderBy: { fechaVigencia: 'desc' }, take: 1 } },
  });

  if (asociado.estado !== 'ACTIVO') {
    throw new ErrorNegocio('El asociado no está activo', 'ASOCIADO_INACTIVO', 409);
  }

  if (valor <= 0n) {
    throw new ErrorNegocio('El salario debe ser mayor que cero', 'SALARIO_INVALIDO', 400);
  }

  const anterior = asociado.salarios[0]?.valor ?? 0n;

  return prisma.salarioAsociado.create({
    data: {
      asociadoId,
      valor,
      fechaVigencia: await hoy(),
      registradoPorId: actor.id,
      soporte,
    },
  });
}

// ============================================================
// DESAFILIACIÓN
// ============================================================

/**
 * Retira a un asociado del fondo y le devuelve sus aportes.
 * No se permite con créditos vigentes.
 */
export async function desafiliarAsociado(
  asociadoId: string,
  cajaId: string,
  actor: UsuarioAutenticado,
) {
  const asociado = await prisma.asociado.findFirstOrThrow({
    where: { id: asociadoId, ...filtroSucursal(actor) },
    include: {
      persona: { select: { nombres: true, apellidos: true } },
      cuentas: { include: { saldoCache: true } },
      creditos: { where: { estado: { in: ['VIGENTE', 'EN_MORA'] } } },
    },
  });

  if (asociado.estado !== 'ACTIVO') {
    throw new ErrorNegocio('El asociado ya está retirado', 'YA_RETIRADO', 409);
  }

  if (asociado.creditos.length > 0) {
    throw new ErrorNegocio(
      `No puede desafiliarse con ${asociado.creditos.length} crédito(s) vigente(s). Debe cancelarlos primero.`,
      'CREDITOS_VIGENTES',
      409,
    );
  }

  const cuentaAportes = asociado.cuentas.find((c) => c.tipo === 'APORTES_SOCIALES');
  const cuentaAhorro = asociado.cuentas.find((c) => c.tipo === 'AHORRO_VOLUNTARIO');

  const saldoAportes = cuentaAportes?.saldoCache?.saldo ?? 0n;
  const saldoAhorro = cuentaAhorro?.saldoCache?.saldo ?? 0n;
  const totalDevolver = saldoAportes + saldoAhorro;

  const caja = await obtenerCuentaDeCaja(cajaId);

  if (totalDevolver > 0n) {
    const lineas: Array<{ cuentaId?: string; planCuentaId?: string; monto: bigint }> = [];

    if (saldoAportes > 0n) {
      lineas.push({ cuentaId: cuentaAportes!.id, monto: saldoAportes });
    }
    if (saldoAhorro > 0n) {
      lineas.push({ cuentaId: cuentaAhorro!.id, monto: saldoAhorro });
    }
    lineas.push({ planCuentaId: caja.planCuentaId, monto: -totalDevolver });

    await registrarTransaccion({
      tipo: 'DEVOLUCION_APORTES',
      descripcion: `Devolución por desafiliación de ${asociado.persona.nombres} ${asociado.persona.apellidos}`,
      creadoPorId: actor.id,
      sucursalId: asociado.sucursalId,
      cajaId,
      claveIdempotencia: `desafiliacion-${asociadoId}`,
      lineas: lineas as any,
    });
  }

  const fecha = await hoy();

  await prisma.$transaction(async (tx) => {
    await tx.asociado.update({
      where: { id: asociadoId },
      data: { estado: 'RETIRADO', fechaDesafiliacion: fecha },
    });

    await tx.cuenta.updateMany({
      where: { asociadoId },
      data: { estado: 'CERRADA', fechaCierre: fecha },
    });

    await tx.tarjeta.updateMany({
      where: { cuenta: { asociadoId } },
      data: { estado: 'CANCELADA' },
    });

    const usuario = await tx.usuario.findUnique({
      where: { personaId: asociado.personaId },
    });

    // Si además es empleado del fondo, conserva su acceso
    const empleado = await tx.empleado.findUnique({
      where: { personaId: asociado.personaId },
    });

    if (usuario && !empleado) {
      await tx.usuario.update({
        where: { id: usuario.id },
        data: { estado: 'INACTIVO' },
      });
    }
  });

  return { asociadoId, totalDevuelto: totalDevolver, fechaDesafiliacion: fecha };
}

/** Bloquea o desbloquea una cuenta */
export async function cambiarEstadoCuenta(
  cuentaId: string,
  nuevoEstado: 'ACTIVA' | 'BLOQUEADA',
  actor: UsuarioAutenticado,
) {
  const cuenta = await prisma.cuenta.findUniqueOrThrow({
    where: { id: cuentaId },
    include: { asociado: { select: { sucursalId: true, estado: true } } },
  });

  verificarAccesoASucursal(actor, cuenta.asociado.sucursalId);

  if (cuenta.estado === 'CERRADA') {
    throw new ErrorNegocio('La cuenta está cerrada', 'CUENTA_CERRADA', 409);
  }

  return prisma.cuenta.update({
    where: { id: cuentaId },
    data: { estado: nuevoEstado },
  });
}
