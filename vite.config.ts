import fs from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

const rootDir = process.cwd();

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'copy-static-assets',
        closeBundle() {
          const jsSrc = path.resolve(rootDir, 'js');
          const jsDist = path.resolve(rootDir, 'dist/js');
          if (fs.existsSync(jsSrc)) {
            fs.cpSync(jsSrc, jsDist, { recursive: true });
          }
          const cssSrc = path.resolve(rootDir, 'css');
          const cssDist = path.resolve(rootDir, 'dist/css');
          if (fs.existsSync(cssSrc)) {
            fs.cpSync(cssSrc, cssDist, { recursive: true });
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': rootDir,
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(rootDir, 'index.html'),
          admin: path.resolve(rootDir, 'admin.html'),
          employees: path.resolve(rootDir, 'employees.html'),
          leaves: path.resolve(rootDir, 'leaves.html'),
          settings: path.resolve(rootDir, 'settings.html'),
          employee: path.resolve(rootDir, 'employee.html'),
          payslip: path.resolve(rootDir, 'payslip.html'),
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

