
# 001 — La vinculación usa dos transacciones separadas

Fecha: 2026-09-11
Estado: aceptada

## Contexto

Vincular un asociado hace dos cosas: crea entidades (persona, asociado,
usuario, cuentas, salario) y cobra la cuota de afiliación en ventanilla.

Lo natural sería envolver todo en una sola transacción de base de datos,
para que sea atómico: o pasa todo o no pasa nada.

## Problema

El servicio de contabilidad (`registrarTransaccion`) abre su propia
transacción con aislamiento Serializable, y es la única puerta del sistema
hacia el dinero. Para meterlo dentro de una transacción externa habría que
permitirle recibir un cliente transaccional desde afuera.

Eso abriría la puerta a que cualquier módulo escriba asientos dentro de su
propia transacción, sin las garantías de aislamiento del servicio contable.

## Decisión

Se parte en dos fases:

1. Una transacción crea las entidades.
2. Una llamada a `registrarTransaccion` cobra la afiliación, con su
   propia transacción.

## Consecuencia aceptada

Si la fase 2 falla, queda un asociado creado que no pagó la afiliación.
Es un caso raro porque las validaciones ya pasaron antes.

Se mitiga con la clave de idempotencia `afiliacion-{asociadoId}`, que
permite reintentar el cobro sin duplicarlo, y con un reporte de
conciliación que liste asociados sin transacción de afiliación.

## Alternativa descartada

Permitir que `registrarTransaccion` reciba un cliente transaccional
externo. Se descartó porque debilita la garantía central del sistema:
que todo el dinero pasa por un único camino controlado.
