import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import path from "path";

export default defineConfig({
  vite: {
    resolve: {
      alias: {
        "react-router-dom": path.resolve(__dirname, "src/lib/react-router-shim.tsx"),
      },
    },
  },
});
