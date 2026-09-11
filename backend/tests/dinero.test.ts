import { describe, it, expect } from 'vitest';
import {
  pesosACentavos,
  centavosAPesos,
  aplicarPorcentaje,
  sumar,
} from '../src/comun/dinero.js';

describe('conversión de montos', () => {
  it('convierte pesos a centavos', () => {
    expect(pesosACentavos(1000)).toBe(100_000n);
    expect(pesosACentavos(1_000_000)).toBe(100_000_000n);
  });

  it('maneja decimales sin perder precisión', () => {
    expect(pesosACentavos(1500.5)).toBe(150_050n);
    expect(pesosACentavos(0.01)).toBe(1n);
  });

  it('vuelve de centavos a pesos', () => {
    expect(centavosAPesos(100_000_000n)).toBe(1_000_000);
  });

  it('rechaza valores inválidos', () => {
    expect(() => pesosACentavos(NaN)).toThrow();
    expect(() => pesosACentavos(Infinity)).toThrow();
  });
});

describe('cálculo de porcentajes', () => {
  it('calcula el 1,5% mensual de un crédito', () => {
    // 1,5% de $2.000.000 = $30.000
    expect(aplicarPorcentaje(200_000_000n, 1.5)).toBe(3_000_000n);
  });

  it('calcula el aporte anual (5% del salario)', () => {
    // 5% de $19.200.000 anuales = $960.000
    expect(aplicarPorcentaje(1_920_000_000n, 5)).toBe(96_000_000n);
  });

  it('calcula la mora del 2% mensual', () => {
    // 2% de $183.362 = $3.667,24 -> se redondea hacia abajo al centavo
    expect(aplicarPorcentaje(18_336_200n, 2)).toBe(366_724n);
  });

  it('maneja porcentajes con decimales', () => {
    // 0,5% mensual (6% anual / 12) de $120.000 = $600
    expect(aplicarPorcentaje(12_000_000n, 0.5)).toBe(60_000n);
  });
});

describe('suma de montos', () => {
  it('suma una lista', () => {
    expect(sumar([100n, 200n, 300n])).toBe(600n);
  });

  it('una transacción balanceada suma cero', () => {
    expect(sumar([101_000_000n, -5_000_000n, -96_000_000n])).toBe(0n);
  });

  it('lista vacía da cero', () => {
    expect(sumar([])).toBe(0n);
  });
});