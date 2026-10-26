import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    define: {
      "process.env.PUBLIC_URL": JSON.stringify(""),
      "process.env.REACT_APP_API_URL": JSON.stringify(
        env.VITE_API_URL || env.REACT_APP_API_URL || "/api",
      ),
    },
    server: { port: 3000, proxy: { "/api": "http://127.0.0.1:8080" } },
    build: { outDir: "build", sourcemap: false },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.js"],
      include: ["src/**/*.test.{js,jsx}"],
      globals: true,
    },
  };
});
