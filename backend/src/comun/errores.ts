export class ErrorNegocio extends Error {
  constructor(
    mensaje: string,
    public readonly codigo: string,
    public readonly estadoHttp: number = 400,
  ) {
    super(mensaje);
    this.name = 'ErrorNegocio';
  }
}

export class AsientosDesbalanceados extends ErrorNegocio {
  constructor(diferencia: bigint) {
    super(
      `Los asientos no suman cero. Diferencia: ${diferencia} centavos.`,
      'ASIENTOS_DESBALANCEADOS',
      422,
    );
  }
}

export class SaldoInsuficiente extends ErrorNegocio {
  constructor(disponible: bigint, requerido: bigint) {
    super(
      `Saldo insuficiente. Disponible: ${disponible}, requerido: ${requerido}.`,
      'SALDO_INSUFICIENTE',
      409,
    );
  }
}

export class CuentaNoOperativa extends ErrorNegocio {
  constructor(cuentaId: string, estado: string) {
    super(
      `La cuenta ${cuentaId} no está operativa (estado: ${estado}).`,
      'CUENTA_NO_OPERATIVA',
      409,
    );
  }
}

export class TransaccionDuplicada extends ErrorNegocio {
  constructor(clave: string) {
    super(
      `Ya existe una transacción con la clave de idempotencia ${clave}.`,
      'TRANSACCION_DUPLICADA',
      409,
    );
  }
}