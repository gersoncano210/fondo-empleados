import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

/** Tipo del cliente dentro de una transacción, para pasarlo entre funciones */
export type PrismaTx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];