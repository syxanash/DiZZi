import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = `http://localhost:${env.BACKEND_PORT || 4567}`;

  const proxy = {
    '/api': target,
    '/ws': { target, ws: true },
  };

  return {
    plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
    server: { proxy },
    preview: { proxy },
  };
});
