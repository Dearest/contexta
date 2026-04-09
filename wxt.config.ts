import { defineConfig } from 'wxt';
import path from 'path';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Contexta - AI Translation',
    description: 'AI-powered web article translation',
    permissions: ['storage', 'activeTab'],
    // Fixed key ensures stable extension ID across rebuilds.
    // Without this, chrome.storage.local data (API keys, config) is lost on rebuild.
    // See: exp-book/chrome-extension-indexeddb-data-loss-manifest-key.md
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsHyUH1uZHA4ORgkGbMfPHwHiez4mchZRdk7LVQajEQ06uzX+o7hKMNzxLwc/WuEirhEaqkNx6SpiThB3jWBQ2TQOZpbcXsY4xpKcRgvZJpdkP9z8QwoPPcKoMFG3TnjkTr/XHdiciPvd6N27SRk6Z+ZKBGHy0Aeurhgi/icbvpay+TTWdDLAlzjpArfxtmVXmEMtYUBGKSdDwoZ6mcEG2FvqqZxDAW/Olx8vIfbH4FY+soUrnk5SsSQH0EtpGvWkKa769Um9ugtZ3C8qbXFrU5v2DF4Sw97We3TQdiPQN1kcOXSS1G8+Tfq8c/X+OC6V68YgPiib90Ut1uL0Lv91OwIDAQAB',
  },
  vite: () => ({
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  }),
});
