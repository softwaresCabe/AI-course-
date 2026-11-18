import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Single-file build so the whole course ships as one HTML page (no server needed).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { chunkSizeWarningLimit: 4000 },
})
