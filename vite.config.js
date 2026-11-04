import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// npm run dev → desarrollo normal · npm run build → dist/index.html (un solo archivo, funciona sin servidor)
export default defineConfig({ plugins: [viteSingleFile()] });
