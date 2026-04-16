import { describe, expect, it, vi } from "vitest";

// Mock modules before importing extension
vi.mock("@mariozechner/pi-coding-agent", () => ({
	Editor: vi.fn(),
	Key: {},
	matchesKey: vi.fn(),
	Text: vi.fn(),
	truncateToWidth: vi.fn((s: string) => s),
}));

vi.mock("@mariozechner/pi-tui", () => ({
	Editor: vi.fn().mockImplementation(() => ({
		handleInput: vi.fn(),
		setText: vi.fn(),
		onSubmit: null,
		render: vi.fn(() => []),
	})),
	Key: {
		up: "up",
		down: "down",
		enter: "enter",
		escape: "escape",
		tab: "tab",
		left: "left",
		right: "right",
		shift: (key: string) => `shift+${key}`,
	},
	matchesKey: vi.fn(),
	Text: vi.fn().mockImplementation((text) => ({ text, line: 0, col: 0 })),
	truncateToWidth: vi.fn((s: string) => s),
}));

// Import extension after mocks
import questionnaire from "../extensions/index.js";

describe("Tool Registration", () => {
	it("registers tool with correct name", () => {
		const mockPi = {
			registerTool: vi.fn(),
		} as unknown as { registerTool: (tool: unknown) => void };

		questionnaire(mockPi);

		expect(mockPi.registerTool).toHaveBeenCalledTimes(1);

		const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

		expect(registeredTool).toHaveProperty("name", "question");
	});

	it("registers tool with correct label", () => {
		const mockPi = {
			registerTool: vi.fn(),
		} as unknown as { registerTool: (tool: unknown) => void };

		questionnaire(mockPi);

		const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

		expect(registeredTool).toHaveProperty("label", "Question");
	});

	it("registers tool with non-empty description", () => {
		const mockPi = {
			registerTool: vi.fn(),
		} as unknown as { registerTool: (tool: unknown) => void };

		questionnaire(mockPi);

		const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

		expect(registeredTool).toHaveProperty("description");
		expect(typeof registeredTool.description).toBe("string");
		expect(registeredTool.description.length).toBeGreaterThan(0);
	});

	it("registers tool with parameters schema", () => {
		const mockPi = {
			registerTool: vi.fn(),
		} as unknown as { registerTool: (tool: unknown) => void };

		questionnaire(mockPi);

		const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

		expect(registeredTool).toHaveProperty("parameters");
		expect(registeredTool.parameters).toBeDefined();
	});

	it("registers tool with execute function", () => {
		const mockPi = {
			registerTool: vi.fn(),
		} as unknown as { registerTool: (tool: unknown) => void };

		questionnaire(mockPi);

		const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

		expect(registeredTool).toHaveProperty("execute");
		expect(typeof registeredTool.execute).toBe("function");
	});

	it("registers tool with renderCall function", () => {
		const mockPi = {
			registerTool: vi.fn(),
		} as unknown as { registerTool: (tool: unknown) => void };

		questionnaire(mockPi);

		const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

		expect(registeredTool).toHaveProperty("renderCall");
		expect(typeof registeredTool.renderCall).toBe("function");
	});

	it("registers tool with renderResult function", () => {
		const mockPi = {
			registerTool: vi.fn(),
		} as unknown as { registerTool: (tool: unknown) => void };

		questionnaire(mockPi);

		const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

		expect(registeredTool).toHaveProperty("renderResult");
		expect(typeof registeredTool.renderResult).toBe("function");
	});

	it("execute returns error when no UI available", async () => {
		const mockPi = {
			registerTool: vi.fn(),
		} as unknown as { registerTool: (tool: unknown) => void };

		questionnaire(mockPi);

		const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

		const result = await registeredTool.execute(
			"call-id",
			{ questions: [{ questionTopic: "Test", prompt: "Test?", options: [{ value: "a", label: "A" }] }] },
			new AbortController().signal,
			vi.fn(),
			{ hasUI: false }
		);

		expect(result.content[0]).toHaveProperty("type", "text");
		expect(result.content[0].text).toContain("Error");
		expect(result.details).toHaveProperty("cancelled", true);
	});

	it("execute returns error when no questions provided", async () => {
		const mockPi = {
			registerTool: vi.fn(),
		} as unknown as { registerTool: (tool: unknown) => void };

		questionnaire(mockPi);

		const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

		const result = await registeredTool.execute(
			"call-id",
			{ questions: [] },
			new AbortController().signal,
			vi.fn(),
			{ hasUI: true, ui: { custom: vi.fn() } }
		);

		expect(result.content[0]).toHaveProperty("type", "text");
		expect(result.content[0].text).toContain("Error: No questions provided");
		expect(result.details).toHaveProperty("cancelled", true);
	});
});
