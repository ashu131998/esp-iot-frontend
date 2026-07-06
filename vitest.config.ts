import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/lib/**'],
      exclude: ['src/lib/server/**'],
    },
  },
});
