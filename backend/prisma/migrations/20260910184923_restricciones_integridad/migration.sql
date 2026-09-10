-- Un asiento pertenece a una cuenta de asociado O a una del fondo, nunca a ambas ni a ninguna
ALTER TABLE "Asiento"
  ADD CONSTRAINT "asiento_una_sola_cuenta"
  CHECK (
    ("cuentaId" IS NOT NULL AND "planCuentaId" IS NULL)
    OR
    ("cuentaId" IS NULL AND "planCuentaId" IS NOT NULL)
  );


  -- Montos que representan valores absolutos no pueden ser negativos
ALTER TABLE "Credito"
  ADD CONSTRAINT "credito_montos_positivos"
  CHECK ("montoDesembolsado" > 0 AND "saldoCapital" >= 0);

ALTER TABLE "Cuota"
  ADD CONSTRAINT "cuota_montos_positivos"
  CHECK ("capital" >= 0 AND "interes" >= 0 AND "total" >= 0 AND "montoPagado" >= 0);

ALTER TABLE "SolicitudCredito"
  ADD CONSTRAINT "solicitud_monto_positivo"
  CHECK ("montoSolicitado" > 0 AND "plazoMeses" > 0);

ALTER TABLE "SalarioAsociado"
  ADD CONSTRAINT "salario_positivo"
  CHECK ("valor" > 0);


  -- Regla de negocio: el saldo nunca queda negativo
ALTER TABLE "SaldoCache"
  ADD CONSTRAINT "saldo_no_negativo"
  CHECK ("saldo" >= 0);


  -- La bitacora de auditoria no se puede modificar ni borrar
CREATE OR REPLACE FUNCTION bloquear_modificacion_auditoria()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'La bitacora de auditoria es de solo insercion. Operacion % rechazada.', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auditoria_sin_update
  BEFORE UPDATE ON "BitacoraAuditoria"
  FOR EACH ROW EXECUTE FUNCTION bloquear_modificacion_auditoria();

CREATE TRIGGER trg_auditoria_sin_delete
  BEFORE DELETE ON "BitacoraAuditoria"
  FOR EACH ROW EXECUTE FUNCTION bloquear_modificacion_auditoria();


  -- Solo puede existir una configuracion de reloj
ALTER TABLE "RelojSistema"
  ADD CONSTRAINT "reloj_fila_unica"
  CHECK ("id" = 1);