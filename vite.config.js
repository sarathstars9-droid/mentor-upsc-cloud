import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api/script": {
        target:
          "https://script.google.com/macros/s/AKfycbyOaohtPtFG7wPZw1Kd4gl7D8pbW1cka19wSYKyjlnu9fUUJZyEUDbxyAoSfJMhidhs6g",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/script/, "/exec"),
      },
    },
  },
});