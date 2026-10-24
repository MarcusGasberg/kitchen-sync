import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { snippets } from "./src/build/snippet-plugin";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    snippets(),
    tanstackStart({
      spa: {
        enabled: true,
      },
    }),
    nitro(),
    viteReact(),
  ],
});

export default config;
