import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    https: false,   // MUST BE FALSE
  },
  plugins: [react()],
});
