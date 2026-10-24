import { defineConfig } from 'vitest/config';

// Without its own config, vitest walks up and loads the Next.js app's
// vitest.config.ts, whose dependencies are not installed for this package.
export default defineConfig({});
