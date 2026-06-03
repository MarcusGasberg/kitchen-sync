import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [tanstackStart(), viteReact()],
	test: {
		environment: "jsdom",
	},
});
