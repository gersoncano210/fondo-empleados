import { ahora } from './reloj.js';
import { obtenerParametroTexto } from './parametros.js';
import { ErrorNegocio } from './errores.js';

/**
 * Las operaciones de ventanilla solo se permiten en horario bancario.
 * El portal del asociado opera 24/7 y no pasa por aquí.
 */
export async function verificarHorarioVentanilla(): Promise<void> {
  const fecha = await ahora();
  const dia = fecha.getDay(); // 0 domingo, 6 sábado

  if (dia === 0) {
    throw new ErrorNegocio(
      'La ventanilla no opera los domingos',
      'FUERA_DE_HORARIO',
      409,
    );
  }

  const inicio = await obtenerParametroTexto('horario.ventanilla_inicio');
  const fin =
    dia === 6
      ? await obtenerParametroTexto('horario.ventanilla_fin_sabado')
      : await obtenerParametroTexto('horario.ventanilla_fin');

  const minutosActuales = fecha.getHours() * 60 + fecha.getMinutes();

  if (minutosActuales < aMinutos(inicio) || minutosActuales >= aMinutos(fin)) {
    throw new ErrorNegocio(
      `Fuera del horario de ventanilla (${inicio} a ${fin})`,
      'FUERA_DE_HORARIO',
      409,
    );
  }
}

function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Para mostrar en el frontend si la ventanilla está abierta */
export async function estadoVentanilla() {
  try {
    await verificarHorarioVentanilla();
    return { abierta: true, mensaje: 'Ventanilla abierta' };
  } catch (e: any) {
    return { abierta: false, mensaje: e.message };
  }
}