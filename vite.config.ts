
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  
  // USER PROVIDED KEY - HARDCODED FOR DIRECT USAGE
  const GEMINI_KEY = "AIzaSyA6OCv5X0ps7Shu_0OKYrqs2o4P1YiD3ME";

  return {
    plugins: [react()],
    define: {
      // Polyfill process.env.API_KEY for the Gemini SDK
      // Priority: Vercel Env Var > Hardcoded Key
      'process.env.API_KEY': JSON.stringify(env.API_KEY || GEMINI_KEY),
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
    },
    server: {
      host: true,
    }
  };
});
