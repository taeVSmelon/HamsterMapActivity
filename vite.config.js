import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

// https://vite.dev/config/
export default defineConfig({
  envDir: './',
  plugins: [vue()],
  server: {
    port: 8000,
    allowedHosts: [
      'hamstermapactivity-production.up.railway.app',
      'barry-reputation-presented-this.trycloudflare.com',
      'localhost',  // ถ้ายังไม่เพิ่ม localhost
    ],
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.SERVER_PORT}`, // backend server
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
