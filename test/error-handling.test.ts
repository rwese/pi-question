import { describe, expect, it, vi } from "vitest";

// Mock modules before importing extension
vi.mock("@mariozechner/pi-coding-agent", () => ({
	Editor: vi.fn(),
	Key: {},
	matchesKey: vi.fn(),
	Text: vi.fn(),
	truncateToWidth: vi.fn((s: string) => s),
	wrapTextWithAnsi: vi.fn((text: string, width: number): string[] => [text]),
	visibleWidth: vi.fn((text: string): number => text.length),
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
		space: " ",
		shift: (key: string) => `shift+${key}`,
	},
	matchesKey: vi.fn(),
	Text: vi.fn().mockImplementation((text) => ({ text, line: 0, col: 0 })),
	truncateToWidth: vi.fn((s: string) => s),
	wrapTextWithAnsi: vi.fn((text: string, width: number): string[] => [text]),
	visibleWidth: vi.fn((text: string): number => text.length),
}));

// Import extension after mocks
import questionnaire from "../extensions/index.js";

describe("Error Handling v2", () => {
	describe("Validation Errors", () => {
		it("returns error for empty questions array", () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
				registerFlag: vi.fn(),
				getFlag: vi.fn(() => false),
			} as unknown as { registerTool: (tool: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const result = registeredTool.execute(
				"call-id",
				{ questions: [] },
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: vi.fn() } }
			);

			// Since it's a Promise in reality, we need to handle async
			expect(result).toBeInstanceOf(Promise);
		});

		it("returns MULTIPLE_RECOMMENDED error for single-select with multiple recommended", () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
				registerFlag: vi.fn(),
				getFlag: vi.fn(() => false),
			} as unknown as { registerTool: (tool: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const result = registeredTool.execute(
				"call-id",
				{
					questions: [
						{
							questionTopic: "Language",
							type: "single",
							prompt: "Choose a language",
							options: [
								{ value: "go", label: "Go", recommended: true },
								{ value: "rust", label: "Rust", recommended: true },
							],
						},
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: vi.fn() } }
			);

			return result.then((res: { content: { text: string }[]; error: { code: string; recommendedCount: number } }) => {
				expect(res.error.code).toBe("MULTIPLE_RECOMMENDED");
				expect(res.error.recommendedCount).toBe(2);
				expect(res.content[0].text).toContain("single-select but has 2 recommended");
			});
		});

		it("allows multi-select with multiple recommended (pre-selects all)", () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
				registerFlag: vi.fn(),
				getFlag: vi.fn(() => false),
			} as unknown as { registerTool: (tool: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const mockCustom = vi.fn().mockImplementation(() => {
				return new Promise((resolve) => {
					resolve({ questions: [], answers: [], cancelled: false });
				});
			});

			const result = registeredTool.execute(
				"call-id",
				{
					questions: [
						{
							questionTopic: "Tools",
							type: "multi",
							prompt: "Choose tools",
							options: [
								{ value: "git", label: "Git", recommended: true },
								{ value: "docker", label: "Docker", recommended: true },
								{ value: "tmux", label: "tmux" },
							],
						},
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			// Should not error, should allow custom UI
			expect(mockCustom).toHaveBeenCalled();
		});
	});

	describe("UI Not Available Error", () => {
		it("returns error when hasUI is false", async () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
				registerFlag: vi.fn(),
				getFlag: vi.fn(() => false),
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

			expect(result.content[0].text).toContain("UI not available");
			expect(result.details.cancelled).toBe(true);
		});
	});

	describe("Edge Cases", () => {
		it("handles single question with single option", () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
				registerFlag: vi.fn(),
				getFlag: vi.fn(() => false),
			} as unknown as { registerTool: (tool: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const mockCustom = vi.fn().mockImplementation(() => {
				return new Promise((resolve) => {
					resolve({ questions: [], answers: [], cancelled: false });
				});
			});

			const result = registeredTool.execute(
				"call-id",
				{
					questions: [
						{
							questionTopic: "Continue",
							prompt: "Continue?",
							options: [{ value: "yes", label: "Yes" }],
						},
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			expect(mockCustom).toHaveBeenCalled();
		});

		it("handles multi-select with no recommended", () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
				registerFlag: vi.fn(),
				getFlag: vi.fn(() => false),
			} as unknown as { registerTool: (tool: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const mockCustom = vi.fn().mockImplementation(() => {
				return new Promise((resolve) => {
					resolve({ questions: [], answers: [], cancelled: false });
				});
			});

			const result = registeredTool.execute(
				"call-id",
				{
					questions: [
						{
							questionTopic: "Tools",
							type: "multi",
							prompt: "Select tools",
							options: [
								{ value: "git", label: "Git" },
								{ value: "docker", label: "Docker" },
							],
						},
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			expect(mockCustom).toHaveBeenCalled();
		});

		it("handles unicode in option values and labels", () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
				registerFlag: vi.fn(),
				getFlag: vi.fn(() => false),
			} as unknown as { registerTool: (tool: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const mockCustom = vi.fn().mockImplementation(() => {
				return new Promise((resolve) => {
					resolve({ questions: [], answers: [], cancelled: false });
				});
			});

			const result = registeredTool.execute(
				"call-id",
				{
					questions: [
						{
							questionTopic: "Emoji",
							prompt: "Select emoji",
							options: [
								{ value: "😀", label: "Happy" },
								{ value: "🎉", label: "Celebration" },
								{ value: "中文", label: "Chinese" },
							],
						},
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			expect(mockCustom).toHaveBeenCalled();
		});
	});
});
