-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('CC', 'CE', 'PASAPORTE');

-- CreateEnum
CREATE TYPE "Cargo" AS ENUM ('ADMINISTRADOR', 'GERENTE', 'ASESOR', 'CAJERO', 'RRHH', 'REVISOR_FISCAL');

-- CreateEnum
CREATE TYPE "EstadoEmpleado" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "EstadoAsociado" AS ENUM ('ACTIVO', 'RETIRADO');

-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('ACTIVO', 'BLOQUEADO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "EstadoGenerico" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "EstadoCaja" AS ENUM ('ABIERTA', 'CERRADA', 'CUADRADA', 'DESCUADRADA');

-- CreateEnum
CREATE TYPE "FamiliaCuenta" AS ENUM ('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO');

-- CreateEnum
CREATE TYPE "TipoCuenta" AS ENUM ('APORTES_SOCIALES', 'AHORRO_VOLUNTARIO');

-- CreateEnum
CREATE TYPE "EstadoCuenta" AS ENUM ('ACTIVA', 'BLOQUEADA', 'CERRADA');

-- CreateEnum
CREATE TYPE "TipoTransaccion" AS ENUM ('AFILIACION', 'APORTE_ANUAL', 'DEPOSITO_VENTANILLA', 'RETIRO_VENTANILLA', 'TRANSFERENCIA', 'PAGO_SIMULADO', 'DESEMBOLSO_CREDITO', 'PAGO_CUOTA', 'CAUSACION_MORA', 'ABONO_INTERESES', 'RETIRO_CAJERO', 'DEVOLUCION_APORTES', 'REVERSO');

-- CreateEnum
CREATE TYPE "DestinoCredito" AS ENUM ('LIBRE_INVERSION', 'EDUCACION', 'VIVIENDA', 'SALUD', 'OTRO');

-- CreateEnum
CREATE TYPE "Veredicto" AS ENUM ('RECOMENDADO', 'REQUIERE_REVISION', 'NO_CUMPLE');

-- CreateEnum
CREATE TYPE "NivelAprobacion" AS ENUM ('ASESOR', 'GERENTE', 'ADMINISTRADOR', 'REVISOR_FISCAL');

-- CreateEnum
CREATE TYPE "EstadoSolicitud" AS ENUM ('RADICADA', 'EN_APROBACION', 'APROBADA', 'RECHAZADA', 'DESEMBOLSADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "Decision" AS ENUM ('APROBADA', 'RECHAZADA', 'DEVUELTA');

-- CreateEnum
CREATE TYPE "EstadoCredito" AS ENUM ('VIGENTE', 'EN_MORA', 'CANCELADO', 'CASTIGADO');

-- CreateEnum
CREATE TYPE "EstadoCuota" AS ENUM ('PENDIENTE', 'PAGADA', 'PAGADA_PARCIAL', 'EN_MORA');

-- CreateEnum
CREATE TYPE "EstadoTarjeta" AS ENUM ('ACTIVA', 'BLOQUEADA', 'VENCIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "AccionAuditoria" AS ENUM ('CREAR', 'ACTUALIZAR', 'APROBAR', 'RECHAZAR', 'CONSULTAR_SENSIBLE', 'BLOQUEAR', 'REVERSAR');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('CREDITO_APROBADO', 'CREDITO_RECHAZADO', 'SOLICITUD_PENDIENTE', 'CUOTA_POR_VENCER', 'CUOTA_EN_MORA', 'RETIRO_AUTORIZADO', 'INTERESES_ABONADOS');

-- CreateEnum
CREATE TYPE "TipoParametro" AS ENUM ('ENTERO', 'DECIMAL', 'MONTO', 'PORCENTAJE', 'BOOLEANO', 'TEXTO', 'HORA');

-- CreateEnum
CREATE TYPE "ModoReloj" AS ENUM ('REAL', 'SIMULADO');

-- CreateTable
CREATE TABLE "Persona" (
    "id" TEXT NOT NULL,
    "tipoDocumento" "TipoDocumento" NOT NULL,
    "numeroDocumento" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "fechaNacimiento" DATE,
    "direccion" TEXT,
    "telefono" TEXT,
    "correoPersonal" TEXT,
    "contactoEmergenciaNombre" TEXT,
    "contactoEmergenciaTelefono" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empleado" (
    "id" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "codigoEmpleado" TEXT NOT NULL,
    "cargo" "Cargo" NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "jefeId" TEXT,
    "fechaIngreso" DATE NOT NULL,
    "fechaRetiro" DATE,
    "correoCorporativo" TEXT,
    "salarioFondo" BIGINT NOT NULL,
    "estado" "EstadoEmpleado" NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT "Empleado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asociado" (
    "id" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "numeroAsociado" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "asesorAsignadoId" TEXT,
    "fechaAfiliacion" DATE NOT NULL,
    "fechaDesafiliacion" DATE,
    "cargoEmpresa" TEXT,
    "estado" "EstadoAsociado" NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT "Asociado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalarioAsociado" (
    "id" TEXT NOT NULL,
    "asociadoId" TEXT NOT NULL,
    "valor" BIGINT NOT NULL,
    "fechaVigencia" DATE NOT NULL,
    "registradoPorId" TEXT NOT NULL,
    "soporte" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalarioAsociado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "correoAcceso" TEXT NOT NULL,
    "hashContrasena" TEXT NOT NULL,
    "estado" "EstadoUsuario" NOT NULL DEFAULT 'ACTIVO',
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" TIMESTAMP(3),
    "ultimoAcceso" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sucursal" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "direccion" TEXT,
    "estado" "EstadoGenerico" NOT NULL DEFAULT 'ACTIVO',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sucursal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Caja" (
    "id" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "cajeroId" TEXT NOT NULL,
    "fechaApertura" TIMESTAMP(3) NOT NULL,
    "fechaCierre" TIMESTAMP(3),
    "saldoInicial" BIGINT NOT NULL DEFAULT 0,
    "saldoFinalContado" BIGINT,
    "saldoFinalSistema" BIGINT,
    "diferencia" BIGINT,
    "estado" "EstadoCaja" NOT NULL DEFAULT 'ABIERTA',

    CONSTRAINT "Caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanCuentas" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "familia" "FamiliaCuenta" NOT NULL,
    "sucursalId" TEXT,
    "estado" "EstadoGenerico" NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT "PlanCuentas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cuenta" (
    "id" TEXT NOT NULL,
    "asociadoId" TEXT NOT NULL,
    "tipo" "TipoCuenta" NOT NULL,
    "numero" TEXT NOT NULL,
    "estado" "EstadoCuenta" NOT NULL DEFAULT 'ACTIVA',
    "fechaApertura" DATE NOT NULL,
    "fechaCierre" DATE,

    CONSTRAINT "Cuenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaccion" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoTransaccion" NOT NULL,
    "descripcion" TEXT,
    "creadoPorId" TEXT NOT NULL,
    "sucursalId" TEXT,
    "cajaId" TEXT,
    "claveIdempotencia" TEXT NOT NULL,
    "reversaDeId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asiento" (
    "id" TEXT NOT NULL,
    "transaccionId" TEXT NOT NULL,
    "cuentaId" TEXT,
    "planCuentaId" TEXT,
    "monto" BIGINT NOT NULL,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "Asiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaldoCache" (
    "cuentaId" TEXT NOT NULL,
    "saldo" BIGINT NOT NULL DEFAULT 0,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaldoCache_pkey" PRIMARY KEY ("cuentaId")
);

-- CreateTable
CREATE TABLE "SaldoCachePlan" (
    "planCuentaId" TEXT NOT NULL,
    "saldo" BIGINT NOT NULL DEFAULT 0,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaldoCachePlan_pkey" PRIMARY KEY ("planCuentaId")
);

-- CreateTable
CREATE TABLE "SolicitudCredito" (
    "id" TEXT NOT NULL,
    "asociadoId" TEXT NOT NULL,
    "montoSolicitado" BIGINT NOT NULL,
    "plazoMeses" INTEGER NOT NULL,
    "destino" "DestinoCredito" NOT NULL,
    "puntaje" INTEGER,
    "veredictoSistema" "Veredicto",
    "detalleEvaluacion" JSONB,
    "cupoDisponible" BIGINT,
    "capacidadPago" BIGINT,
    "nivelRequerido" "NivelAprobacion" NOT NULL,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'RADICADA',
    "radicadaPorId" TEXT NOT NULL,
    "fechaRadicacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitudCredito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AprobacionCredito" (
    "id" TEXT NOT NULL,
    "solicitudId" TEXT NOT NULL,
    "nivel" "NivelAprobacion" NOT NULL,
    "decididoPorId" TEXT NOT NULL,
    "decision" "Decision" NOT NULL,
    "comentario" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AprobacionCredito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credito" (
    "id" TEXT NOT NULL,
    "solicitudId" TEXT NOT NULL,
    "asociadoId" TEXT NOT NULL,
    "montoDesembolsado" BIGINT NOT NULL,
    "tasaMensual" DECIMAL(6,4) NOT NULL,
    "plazoMeses" INTEGER NOT NULL,
    "fechaDesembolso" DATE NOT NULL,
    "saldoCapital" BIGINT NOT NULL,
    "estado" "EstadoCredito" NOT NULL DEFAULT 'VIGENTE',

    CONSTRAINT "Credito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cuota" (
    "id" TEXT NOT NULL,
    "creditoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "fechaVencimiento" DATE NOT NULL,
    "capital" BIGINT NOT NULL,
    "interes" BIGINT NOT NULL,
    "total" BIGINT NOT NULL,
    "saldoCapitalDespues" BIGINT NOT NULL,
    "estado" "EstadoCuota" NOT NULL DEFAULT 'PENDIENTE',
    "fechaPago" DATE,
    "montoPagado" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "Cuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mora" (
    "id" TEXT NOT NULL,
    "cuotaId" TEXT NOT NULL,
    "diasMora" INTEGER NOT NULL,
    "saldoVencido" BIGINT NOT NULL,
    "interesMoratorio" BIGINT NOT NULL,
    "transaccionId" TEXT,
    "calculadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarjeta" (
    "id" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "numeroEnmascarado" TEXT NOT NULL,
    "hashNumero" TEXT NOT NULL,
    "fechaVencimiento" DATE NOT NULL,
    "estado" "EstadoTarjeta" NOT NULL DEFAULT 'ACTIVA',
    "limiteDiario" BIGINT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tarjeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetiroCajero" (
    "id" TEXT NOT NULL,
    "tarjetaId" TEXT NOT NULL,
    "transaccionId" TEXT NOT NULL,
    "monto" BIGINT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetiroCajero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rol" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permiso" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "Permiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolPermiso" (
    "rolId" TEXT NOT NULL,
    "permisoId" TEXT NOT NULL,

    CONSTRAINT "RolPermiso_pkey" PRIMARY KEY ("rolId","permisoId")
);

-- CreateTable
CREATE TABLE "UsuarioRol" (
    "usuarioId" TEXT NOT NULL,
    "rolId" TEXT NOT NULL,

    CONSTRAINT "UsuarioRol_pkey" PRIMARY KEY ("usuarioId","rolId")
);

-- CreateTable
CREATE TABLE "BitacoraAuditoria" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUsuarioId" TEXT,
    "actorRol" TEXT,
    "accion" "AccionAuditoria" NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "datosAntes" JSONB,
    "datosDespues" JSONB,
    "ip" TEXT,
    "sucursalId" TEXT,
    "hashAnterior" TEXT,
    "hashPropio" TEXT NOT NULL,

    CONSTRAINT "BitacoraAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "enlace" TEXT,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parametro" (
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "tipo" "TipoParametro" NOT NULL,
    "descripcion" TEXT,
    "actualizadoPorId" TEXT,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parametro_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "RelojSistema" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "modo" "ModoReloj" NOT NULL DEFAULT 'REAL',
    "fechaSimulada" TIMESTAMP(3),
    "actualizadoPorId" TEXT,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelojSistema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Persona_numeroDocumento_key" ON "Persona"("numeroDocumento");

-- CreateIndex
CREATE INDEX "Persona_numeroDocumento_idx" ON "Persona"("numeroDocumento");

-- CreateIndex
CREATE UNIQUE INDEX "Empleado_personaId_key" ON "Empleado"("personaId");

-- CreateIndex
CREATE UNIQUE INDEX "Empleado_codigoEmpleado_key" ON "Empleado"("codigoEmpleado");

-- CreateIndex
CREATE UNIQUE INDEX "Empleado_correoCorporativo_key" ON "Empleado"("correoCorporativo");

-- CreateIndex
CREATE INDEX "Empleado_sucursalId_idx" ON "Empleado"("sucursalId");

-- CreateIndex
CREATE INDEX "Empleado_cargo_idx" ON "Empleado"("cargo");

-- CreateIndex
CREATE UNIQUE INDEX "Asociado_personaId_key" ON "Asociado"("personaId");

-- CreateIndex
CREATE UNIQUE INDEX "Asociado_numeroAsociado_key" ON "Asociado"("numeroAsociado");

-- CreateIndex
CREATE INDEX "Asociado_sucursalId_idx" ON "Asociado"("sucursalId");

-- CreateIndex
CREATE INDEX "Asociado_estado_idx" ON "Asociado"("estado");

-- CreateIndex
CREATE INDEX "SalarioAsociado_asociadoId_fechaVigencia_idx" ON "SalarioAsociado"("asociadoId", "fechaVigencia");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_personaId_key" ON "Usuario"("personaId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_correoAcceso_key" ON "Usuario"("correoAcceso");

-- CreateIndex
CREATE UNIQUE INDEX "Sucursal_nombre_key" ON "Sucursal"("nombre");

-- CreateIndex
CREATE INDEX "Caja_sucursalId_estado_idx" ON "Caja"("sucursalId", "estado");

-- CreateIndex
CREATE INDEX "Caja_cajeroId_idx" ON "Caja"("cajeroId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanCuentas_codigo_key" ON "PlanCuentas"("codigo");

-- CreateIndex
CREATE INDEX "PlanCuentas_familia_idx" ON "PlanCuentas"("familia");

-- CreateIndex
CREATE INDEX "PlanCuentas_sucursalId_idx" ON "PlanCuentas"("sucursalId");

-- CreateIndex
CREATE UNIQUE INDEX "Cuenta_numero_key" ON "Cuenta"("numero");

-- CreateIndex
CREATE INDEX "Cuenta_estado_idx" ON "Cuenta"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "Cuenta_asociadoId_tipo_key" ON "Cuenta"("asociadoId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "Transaccion_claveIdempotencia_key" ON "Transaccion"("claveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "Transaccion_reversaDeId_key" ON "Transaccion"("reversaDeId");

-- CreateIndex
CREATE INDEX "Transaccion_fecha_idx" ON "Transaccion"("fecha");

-- CreateIndex
CREATE INDEX "Transaccion_tipo_idx" ON "Transaccion"("tipo");

-- CreateIndex
CREATE INDEX "Transaccion_cajaId_idx" ON "Transaccion"("cajaId");

-- CreateIndex
CREATE INDEX "Asiento_transaccionId_idx" ON "Asiento"("transaccionId");

-- CreateIndex
CREATE INDEX "Asiento_cuentaId_idx" ON "Asiento"("cuentaId");

-- CreateIndex
CREATE INDEX "Asiento_planCuentaId_idx" ON "Asiento"("planCuentaId");

-- CreateIndex
CREATE INDEX "SolicitudCredito_asociadoId_idx" ON "SolicitudCredito"("asociadoId");

-- CreateIndex
CREATE INDEX "SolicitudCredito_estado_nivelRequerido_idx" ON "SolicitudCredito"("estado", "nivelRequerido");

-- CreateIndex
CREATE INDEX "AprobacionCredito_solicitudId_idx" ON "AprobacionCredito"("solicitudId");

-- CreateIndex
CREATE UNIQUE INDEX "Credito_solicitudId_key" ON "Credito"("solicitudId");

-- CreateIndex
CREATE INDEX "Credito_asociadoId_estado_idx" ON "Credito"("asociadoId", "estado");

-- CreateIndex
CREATE INDEX "Credito_estado_idx" ON "Credito"("estado");

-- CreateIndex
CREATE INDEX "Cuota_fechaVencimiento_estado_idx" ON "Cuota"("fechaVencimiento", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "Cuota_creditoId_numero_key" ON "Cuota"("creditoId", "numero");

-- CreateIndex
CREATE INDEX "Mora_cuotaId_idx" ON "Mora"("cuotaId");

-- CreateIndex
CREATE UNIQUE INDEX "Tarjeta_hashNumero_key" ON "Tarjeta"("hashNumero");

-- CreateIndex
CREATE INDEX "Tarjeta_cuentaId_idx" ON "Tarjeta"("cuentaId");

-- CreateIndex
CREATE UNIQUE INDEX "RetiroCajero_transaccionId_key" ON "RetiroCajero"("transaccionId");

-- CreateIndex
CREATE INDEX "RetiroCajero_tarjetaId_fecha_idx" ON "RetiroCajero"("tarjetaId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Rol_nombre_key" ON "Rol"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Permiso_clave_key" ON "Permiso"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "BitacoraAuditoria_hashPropio_key" ON "BitacoraAuditoria"("hashPropio");

-- CreateIndex
CREATE INDEX "BitacoraAuditoria_fecha_idx" ON "BitacoraAuditoria"("fecha");

-- CreateIndex
CREATE INDEX "BitacoraAuditoria_entidad_entidadId_idx" ON "BitacoraAuditoria"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "BitacoraAuditoria_actorUsuarioId_idx" ON "BitacoraAuditoria"("actorUsuarioId");

-- CreateIndex
CREATE INDEX "Notificacion_usuarioId_leida_idx" ON "Notificacion"("usuarioId", "leida");

-- AddForeignKey
ALTER TABLE "Empleado" ADD CONSTRAINT "Empleado_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empleado" ADD CONSTRAINT "Empleado_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Empleado" ADD CONSTRAINT "Empleado_jefeId_fkey" FOREIGN KEY ("jefeId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asociado" ADD CONSTRAINT "Asociado_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asociado" ADD CONSTRAINT "Asociado_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asociado" ADD CONSTRAINT "Asociado_asesorAsignadoId_fkey" FOREIGN KEY ("asesorAsignadoId") REFERENCES "Empleado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalarioAsociado" ADD CONSTRAINT "SalarioAsociado_asociadoId_fkey" FOREIGN KEY ("asociadoId") REFERENCES "Asociado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalarioAsociado" ADD CONSTRAINT "SalarioAsociado_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caja" ADD CONSTRAINT "Caja_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caja" ADD CONSTRAINT "Caja_cajeroId_fkey" FOREIGN KEY ("cajeroId") REFERENCES "Empleado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanCuentas" ADD CONSTRAINT "PlanCuentas_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cuenta" ADD CONSTRAINT "Cuenta_asociadoId_fkey" FOREIGN KEY ("asociadoId") REFERENCES "Asociado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_cajaId_fkey" FOREIGN KEY ("cajaId") REFERENCES "Caja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_reversaDeId_fkey" FOREIGN KEY ("reversaDeId") REFERENCES "Transaccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asiento" ADD CONSTRAINT "Asiento_transaccionId_fkey" FOREIGN KEY ("transaccionId") REFERENCES "Transaccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asiento" ADD CONSTRAINT "Asiento_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asiento" ADD CONSTRAINT "Asiento_planCuentaId_fkey" FOREIGN KEY ("planCuentaId") REFERENCES "PlanCuentas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaldoCache" ADD CONSTRAINT "SaldoCache_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaldoCachePlan" ADD CONSTRAINT "SaldoCachePlan_planCuentaId_fkey" FOREIGN KEY ("planCuentaId") REFERENCES "PlanCuentas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudCredito" ADD CONSTRAINT "SolicitudCredito_asociadoId_fkey" FOREIGN KEY ("asociadoId") REFERENCES "Asociado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudCredito" ADD CONSTRAINT "SolicitudCredito_radicadaPorId_fkey" FOREIGN KEY ("radicadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AprobacionCredito" ADD CONSTRAINT "AprobacionCredito_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudCredito"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AprobacionCredito" ADD CONSTRAINT "AprobacionCredito_decididoPorId_fkey" FOREIGN KEY ("decididoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credito" ADD CONSTRAINT "Credito_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "SolicitudCredito"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credito" ADD CONSTRAINT "Credito_asociadoId_fkey" FOREIGN KEY ("asociadoId") REFERENCES "Asociado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cuota" ADD CONSTRAINT "Cuota_creditoId_fkey" FOREIGN KEY ("creditoId") REFERENCES "Credito"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mora" ADD CONSTRAINT "Mora_cuotaId_fkey" FOREIGN KEY ("cuotaId") REFERENCES "Cuota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mora" ADD CONSTRAINT "Mora_transaccionId_fkey" FOREIGN KEY ("transaccionId") REFERENCES "Transaccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarjeta" ADD CONSTRAINT "Tarjeta_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetiroCajero" ADD CONSTRAINT "RetiroCajero_tarjetaId_fkey" FOREIGN KEY ("tarjetaId") REFERENCES "Tarjeta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetiroCajero" ADD CONSTRAINT "RetiroCajero_transaccionId_fkey" FOREIGN KEY ("transaccionId") REFERENCES "Transaccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolPermiso" ADD CONSTRAINT "RolPermiso_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolPermiso" ADD CONSTRAINT "RolPermiso_permisoId_fkey" FOREIGN KEY ("permisoId") REFERENCES "Permiso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioRol" ADD CONSTRAINT "UsuarioRol_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioRol" ADD CONSTRAINT "UsuarioRol_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BitacoraAuditoria" ADD CONSTRAINT "BitacoraAuditoria_actorUsuarioId_fkey" FOREIGN KEY ("actorUsuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BitacoraAuditoria" ADD CONSTRAINT "BitacoraAuditoria_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parametro" ADD CONSTRAINT "Parametro_actualizadoPorId_fkey" FOREIGN KEY ("actualizadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelojSistema" ADD CONSTRAINT "RelojSistema_actualizadoPorId_fkey" FOREIGN KEY ("actualizadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
