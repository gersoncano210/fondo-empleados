import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Las pruebas tocan la misma base: deben correr de a una
    fileParallelism: false,
    testTimeout: 20000,
  },
});