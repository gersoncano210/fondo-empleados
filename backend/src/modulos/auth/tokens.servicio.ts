import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../../comun/prisma.js';
import { ErrorNegocio } from '../../comun/errores.js';

const SECRETO_ACCESO = process.env.JWT_SECRETO_ACCESO!;
const SECRETO_REFRESCO = process.env.JWT_SECRETO_REFRESCO!;
const MINUTOS_ACCESO = Number(process.env.JWT_MINUTOS_ACCESO ?? 15);
const DIAS_REFRESCO = Number(process.env.JWT_DIAS_REFRESCO ?? 7);

export interface ContenidoToken {
  usuarioId: string;
  personaId: string;
}

export function firmarTokenAcceso(contenido: ContenidoToken): string {
  return jwt.sign(contenido, SECRETO_ACCESO, {
    expiresIn: `${MINUTOS_ACCESO}m`,
  });
}

export function verificarTokenAcceso(token: string): ContenidoToken {
  try {
    return jwt.verify(token, SECRETO_ACCESO) as ContenidoToken;
  } catch {
    throw new ErrorNegocio('Token inválido o expirado', 'TOKEN_INVALIDO', 401);
  }
}

function hashear(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Emite un token de refresco y lo registra en la base */
export async function emitirTokenRefresco(
  usuarioId: string,
  ip?: string,
): Promise<string> {
  const token = randomBytes(48).toString('hex');
  const expiraEn = new Date();
  expiraEn.setDate(expiraEn.getDate() + DIAS_REFRESCO);

  await prisma.tokenRefresco.create({
    data: { usuarioId, hashToken: hashear(token), expiraEn, ip },
  });

  return token;
}

/**
 * Valida un token de refresco y lo rota: revoca el usado y emite uno nuevo.
 * Si el token ya estaba revocado, revoca TODOS los del usuario:
 * es señal de que alguien está reutilizando un token robado.
 */
export async function rotarTokenRefresco(
  token: string,
  ip?: string,
): Promise<{ usuarioId: string; tokenNuevo: string }> {
  const registro = await prisma.tokenRefresco.findUnique({
    where: { hashToken: hashear(token) },
  });

  if (!registro) {
    throw new ErrorNegocio('Token de refresco inválido', 'REFRESCO_INVALIDO', 401);
  }

  if (registro.revocadoEn) {
    await prisma.tokenRefresco.updateMany({
      where: { usuarioId: registro.usuarioId, revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
    throw new ErrorNegocio(
      'Token de refresco reutilizado. Se cerraron todas las sesiones.',
      'REFRESCO_REUTILIZADO',
      401,
    );
  }

  if (registro.expiraEn < new Date()) {
    throw new ErrorNegocio('Token de refresco expirado', 'REFRESCO_EXPIRADO', 401);
  }

  await prisma.tokenRefresco.update({
    where: { id: registro.id },
    data: { revocadoEn: new Date() },
  });

  const tokenNuevo = await emitirTokenRefresco(registro.usuarioId, ip);
  return { usuarioId: registro.usuarioId, tokenNuevo };
}

/** Cierra una sesión */
export async function revocarTokenRefresco(token: string): Promise<void> {
  await prisma.tokenRefresco.updateMany({
    where: { hashToken: hashear(token), revocadoEn: null },
    data: { revocadoEn: new Date() },
  });
}

/** Cierra todas las sesiones de un usuario */
export async function revocarTodosLosTokens(usuarioId: string): Promise<void> {
  await prisma.tokenRefresco.updateMany({
    where: { usuarioId, revocadoEn: null },
    data: { revocadoEn: new Date() },
  });
}