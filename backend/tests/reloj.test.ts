import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { prisma } from '../src/comun/prisma.js';
import {
  ahora,
  fijarFechaSimulada,
  adelantarDias,
  volverATiempoReal,
  estadoReloj,
} from '../src/comun/reloj.js';
import { usuarioCualquiera } from './ayudantes.js';

afterEach(async () => {
  const usuario = await usuarioCualquiera();
  await volverATiempoReal(usuario.id);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('reloj del sistema', () => {
  it('en modo real devuelve una fecha cercana a la actual', async () => {
    const fecha = await ahora();
    const diferencia = Math.abs(fecha.getTime() - Date.now());
    expect(diferencia).toBeLessThan(5000);
  });

  it('en modo simulado devuelve la fecha fijada', async () => {
    const usuario = await usuarioCualquiera();
    const objetivo = new Date('2027-03-15T10:00:00Z');

    await fijarFechaSimulada(objetivo, usuario.id);

    const fecha = await ahora();
    expect(fecha.toISOString()).toBe(objetivo.toISOString());
  });

  it('adelanta la cantidad de días indicada', async () => {
    const usuario = await usuarioCualquiera();
    await fijarFechaSimulada(new Date('2026-01-01T00:00:00Z'), usuario.id);

    await adelantarDias(120, usuario.id);

    const fecha = await ahora();
    expect(fecha.toISOString().slice(0, 10)).toBe('2026-05-01');
  });

  it('vuelve a tiempo real', async () => {
    const usuario = await usuarioCualquiera();
    await fijarFechaSimulada(new Date('2030-01-01'), usuario.id);
    await volverATiempoReal(usuario.id);

    const estado = await estadoReloj();
    expect(estado.modo).toBe('REAL');
    expect(estado.fechaSimulada).toBeNull();
  });
});