import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

// Single-file build so the whole course ships as one HTML page (no server needed).
export default defineConfig({
  plugins: [
    react(),
    viteSingleFile(),
    {
      // Hosting rejects a literal U+FFFD in the HTML; re-escape it (it only occurs inside JS string literals).
      name: 'escape-replacement-char',
      closeBundle() {
        const f = 'dist/index.html'
        if (existsSync(f)) writeFileSync(f, readFileSync(f, 'utf8').replace(/\uFFFD/g, '\\uFFFD'))
      },
    },
  ],
  build: { chunkSizeWarningLimit: 4000 },
})
