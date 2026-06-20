import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    tsconfig: './tsconfig.test.json',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.config.*'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/core': resolve(__dirname, './src/core'),
      '@/agents': resolve(__dirname, './src/agents'),
      '@/services': resolve(__dirname, './src/services'),
      '@/config': resolve(__dirname, './src/config'),
      '@/api': resolve(__dirname, './src/api'),
      '@/models': resolve(__dirname, './src/models'),
      '@/utils': resolve(__dirname, './src/utils'),
      '@/types': resolve(__dirname, './src/types'),
      '@/demo': resolve(__dirname, './src/demo'),
      '@/lab': resolve(__dirname, './src/lab'),
      '@/eval': resolve(__dirname, './src/eval')
    }
  }
}); 