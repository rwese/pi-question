import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["test/**/*.test.ts"],
		exclude: ["**/node_modules/**"],
		environment: "node",
		clearMocks: true,
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			include: ["extensions/**/*.ts"],
			exclude: ["**/*.d.ts"],
		},
	},
});
