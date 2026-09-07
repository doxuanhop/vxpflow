import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        // fengari (máy ảo Lua) require các module Node lúc nạp — cung cấp stub cho browser
        os: path.resolve(__dirname, 'src/vendor-stubs/os.ts'),
        fs: path.resolve(__dirname, 'src/vendor-stubs/fs.ts'),
        tmp: path.resolve(__dirname, 'src/vendor-stubs/tmp.ts'),
        child_process: path.resolve(__dirname, 'src/vendor-stubs/child_process.ts'),
        'readline-sync': path.resolve(__dirname, 'src/vendor-stubs/readline-sync.ts'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
