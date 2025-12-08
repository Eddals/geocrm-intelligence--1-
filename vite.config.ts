import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const serverPort = Number(env.VITE_PORT || env.PORT || 3000);
    const serverHost = env.VITE_HOST || '0.0.0.0';

    const hmrHost = env.VITE_HMR_HOST || env.VITE_HOST;
    const hmrPort = env.VITE_HMR_PORT ? Number(env.VITE_HMR_PORT) : undefined;
    const hmrClientPort = env.VITE_HMR_CLIENT_PORT ? Number(env.VITE_HMR_CLIENT_PORT) : undefined;
    const hmrProtocol = env.VITE_HMR_PROTOCOL === 'wss' ? 'wss' : 'ws';

    return {
      server: {
        port: serverPort,
        host: serverHost,
        hmr: {
          protocol: hmrProtocol,
          ...(hmrHost ? { host: hmrHost } : {}),
          ...(hmrPort ? { port: hmrPort } : {}),
          ...(hmrClientPort ? { clientPort: hmrClientPort } : {}),
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
