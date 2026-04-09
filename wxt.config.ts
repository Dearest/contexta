import { defineConfig } from 'wxt';
import path from 'path';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Contexta',
    description: 'AI-powered web article translation',
    permissions: ['storage', 'activeTab'],
  },
  vite: () => ({
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  }),
});
