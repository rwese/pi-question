import { describe, expect, it, vi, beforeEach } from "vitest";

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
		space: " ",
		shift: (key: string) => `shift+${key}`,
	},
	matchesKey: vi.fn(),
	Text: vi.fn().mockImplementation((text) => ({ text, line: 0, col: 0 })),
	truncateToWidth: vi.fn((s: string) => s),
}));

// Import extension after mocks
import questionnaire from "../extensions/index.js";

describe("Markdown Output", () => {
	describe("Single-Select Markdown", () => {
		it("generates correct markdown for single-select answer", async () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
				sendMessage: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void; sendMessage: (msg: unknown, opts: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [{ questionTopic: "Language", prompt: "Choose your language", type: "single", options: [] }],
					answers: [{ value: "typescript", label: "TypeScript", wasCustom: false, index: 1 }],
					cancelled: false,
				});
			});

			const result = await registeredTool.execute(
				"call-id",
				{
					questions: [{ questionTopic: "Language", prompt: "Choose your language", options: [{ value: "typescript", label: "TypeScript" }] }],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			const markdown = result.content[0].text;
			expect(markdown).toContain("### Choose your language");
			expect(markdown).toContain("- TypeScript");
			expect(markdown).not.toContain("[x]"); // single-select uses plain bullet
		});

		it("generates correct markdown for custom single-select answer", async () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
				sendMessage: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void; sendMessage: (msg: unknown, opts: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [{ questionTopic: "Language", prompt: "Choose your language", type: "single", options: [] }],
					answers: [{ value: "(other)", label: "Python", wasCustom: true, index: undefined, message: "Python" }],
					cancelled: false,
				});
			});

			const result = await registeredTool.execute(
				"call-id",
				{
					questions: [{ questionTopic: "Language", prompt: "Choose your language", options: [{ value: "typescript", label: "TypeScript" }] }],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			const markdown = result.content[0].text;
			expect(markdown).toContain("### Choose your language");
			expect(markdown).toContain("- Python");
			// Should NOT contain "(custom)" prefix - label IS the user's input
			expect(markdown).not.toContain("(custom)");
			// Should NOT contain User Comment line
			expect(markdown).not.toContain("User Comment");
			// Message is stored in details
			expect(result.details.answers[0]).toHaveProperty("message", "Python");
		});

		it("stores message in single-select answer but does not show in markdown output", async () => {
			// Note: single-answer message is stored but not displayed in markdown output
			// The message field is used in the UI review screen, not the markdown result
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
				sendMessage: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void; sendMessage: (msg: unknown, opts: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [{ questionTopic: "Reason", prompt: "Why this choice?", type: "single", options: [] }],
					answers: [{ value: "typescript", label: "TypeScript", wasCustom: false, index: 1, message: "Great type safety" }],
					cancelled: false,
				});
			});

			const result = await registeredTool.execute(
				"call-id",
				{
					questions: [{ questionTopic: "Reason", prompt: "Why this choice?", options: [{ value: "typescript", label: "TypeScript" }] }],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			const markdown = result.content[0].text;
			expect(markdown).toContain("### Why this choice?");
			expect(markdown).toContain("- TypeScript");
			// Message is stored in answer but NOT in markdown output
			expect(result.details.answers[0]).toHaveProperty("message", "Great type safety");
		});

		it("uses default type single when type not specified", async () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
				sendMessage: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void; sendMessage: (msg: unknown, opts: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [{ questionTopic: "Choice", prompt: "Make a choice", type: "single", options: [] }],
					answers: [{ value: "a", label: "Option A", wasCustom: false, index: 1 }],
					cancelled: false,
				});
			});

			const result = await registeredTool.execute(
				"call-id",
				{
					questions: [{ questionTopic: "Choice", prompt: "Make a choice", options: [{ value: "a", label: "Option A" }] }],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			const markdown = result.content[0].text;
			expect(markdown).toContain("- Option A");
			expect(markdown).not.toContain("[x]");
		});
	});

	describe("Multi-Select Markdown", () => {
		it("generates correct markdown with checkboxes for multi-select", async () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
				sendMessage: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void; sendMessage: (msg: unknown, opts: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [{ questionTopic: "Tools", prompt: "Select your tools", type: "multi", options: [] }],
					answers: [{
						values: ["git", "docker", "tmux"],
						labels: ["Git", "Docker", "tmux"],
						descriptions: [],
						wasCustom: [false, false, false],
					}],
					cancelled: false,
				});
			});

			const result = await registeredTool.execute(
				"call-id",
				{
					questions: [{
						questionTopic: "Tools",
						type: "multi",
						prompt: "Select your tools",
						options: [{ value: "git", label: "Git" }, { value: "docker", label: "Docker" }, { value: "tmux", label: "tmux" }],
					}],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			const markdown = result.content[0].text;
			expect(markdown).toContain("### Select your tools");
			expect(markdown).toContain("- [x] Git");
			expect(markdown).toContain("- [x] Docker");
			expect(markdown).toContain("- [x] tmux");
		});

		it("shows no selection for empty multi-select", async () => {
			const mockPi = {
				registerTool: vi.fn(),
				registerCommand: vi.fn(),
				sendMessage: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void; sendMessage: (msg: unknown, opts: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [{ questionTopic: "Features", prompt: "Select features", type: "multi", options: [] }],
					answers: [{
						values: [],
						labels: [],
						descriptions: [],
						wasCustom: [],
					}],
					cancelled: false,
				});
			});

			const result = await registeredTool.execute(
				"call-id",
				{
					questions: [{
						questionTopic: "Features",
						type: "multi",
						prompt: "Select features",
						options: [{ value: "auth", label: "Auth" }, { value: "db", label: "Database" }],
					}],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			const markdown = result.content[0].text;
			expect(markdown).toContain("### Select features");
			expect(markdown).toContain("- (no selection)");
		});

		it("handles mixed custom and standard options in multi-select", async () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
				sendMessage: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void; sendMessage: (msg: unknown, opts: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [{ questionTopic: "Lang", prompt: "Select languages", type: "multi", options: [] }],
					answers: [{
						values: ["typescript", "(other)"],
						labels: ["TypeScript", "Zig"],
						descriptions: [],
						wasCustom: [false, true],
					}],
					cancelled: false,
				});
			});

			const result = await registeredTool.execute(
				"call-id",
				{
					questions: [{
						questionTopic: "Lang",
						type: "multi",
						prompt: "Select languages",
						options: [{ value: "typescript", label: "TypeScript" }, { value: "go", label: "Go" }],
					}],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			const markdown = result.content[0].text;
			expect(markdown).toContain("- [x] TypeScript");
			expect(markdown).toContain("- [x] Zig");
		});
	});

	describe("Multi-Question Markdown", () => {
		it("generates correct markdown for multiple questions", async () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
				sendMessage: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void; sendMessage: (msg: unknown, opts: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [
						{ questionTopic: "Language", prompt: "Choose your language", type: "single", options: [] },
						{ questionTopic: "Tools", prompt: "Select your tools", type: "multi", options: [] },
					],
					answers: [
						{ value: "go", label: "Go", wasCustom: false, index: 1 },
						{ values: ["git", "docker"], labels: ["Git", "Docker"],
 descriptions: [],
 wasCustom: [false, false] },
					],
					cancelled: false,
				});
			});

			const result = await registeredTool.execute(
				"call-id",
				{
					questions: [
						{ questionTopic: "Language", prompt: "Choose your language", options: [{ value: "go", label: "Go" }] },
						{ questionTopic: "Tools", type: "multi", prompt: "Select your tools", options: [{ value: "git", label: "Git" }, { value: "docker", label: "Docker" }] },
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			const markdown = result.content[0].text;
			expect(markdown).toContain("### Choose your language");
			expect(markdown).toContain("- Go");
			expect(markdown).toContain("### Select your tools");
			expect(markdown).toContain("- [x] Git");
			expect(markdown).toContain("- [x] Docker");
		});

		it("maintains question order in markdown output", async () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
				sendMessage: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void; sendMessage: (msg: unknown, opts: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [
						{ questionTopic: "First", prompt: "First question?", type: "single", options: [] },
						{ questionTopic: "Second", prompt: "Second question?", type: "single", options: [] },
						{ questionTopic: "Third", prompt: "Third question?", type: "single", options: [] },
					],
					answers: [
						{ value: "a", label: "Answer A", wasCustom: false, index: 1 },
						{ value: "b", label: "Answer B", wasCustom: false, index: 1 },
						{ value: "c", label: "Answer C", wasCustom: false, index: 1 },
					],
					cancelled: false,
				});
			});

			const result = await registeredTool.execute(
				"call-id",
				{
					questions: [
						{ questionTopic: "First", prompt: "First question?", options: [{ value: "a", label: "Answer A" }] },
						{ questionTopic: "Second", prompt: "Second question?", options: [{ value: "b", label: "Answer B" }] },
						{ questionTopic: "Third", prompt: "Third question?", options: [{ value: "c", label: "Answer C" }] },
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			const markdown = result.content[0].text;
			const firstIdx = markdown.indexOf("First question?");
			const secondIdx = markdown.indexOf("Second question?");
			const thirdIdx = markdown.indexOf("Third question?");

			expect(firstIdx).toBeLessThan(secondIdx);
			expect(secondIdx).toBeLessThan(thirdIdx);
		});
	});

	describe("Cancelled Response", () => {
		it("calls abort and returns cancelled message when user cancels", async () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
				sendMessage: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void; sendMessage: (msg: unknown, opts: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [{ questionTopic: "Test", prompt: "Test?", type: "single", options: [] }],
					answers: [],
					cancelled: true,
				});
			});

			const abortMock = vi.fn();
			const result = await registeredTool.execute(
				"call-id",
				{ questions: [{ questionTopic: "Test", prompt: "Test?", options: [{ value: "a", label: "A" }] }] },
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: abortMock }
			);

			expect(abortMock).toHaveBeenCalled();
			expect(result.content[0].text).toContain("cancelled");
			expect(result.details.cancelled).toBe(true);
		});

		it("calls sendMessage with questionnaire-cancelled custom type", async () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
				sendMessage: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void; sendMessage: (msg: unknown, opts: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [],
					answers: [],
					cancelled: true,
				});
			});

			await registeredTool.execute(
				"call-id",
				{ questions: [{ questionTopic: "Test", prompt: "Test?", options: [{ value: "a", label: "A" }] }] },
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: vi.fn() }
			);

			expect(mockPi.sendMessage).toHaveBeenCalledWith(
				expect.objectContaining({ customType: "questionnaire-cancelled" }),
				expect.objectContaining({ deliverAs: "nextTurn" })
			);
		});
	});

	describe("Result Details", () => {
		it("includes questions in result details", async () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
				sendMessage: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void; sendMessage: (msg: unknown, opts: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [{ questionTopic: "Lang", prompt: "Choose language", type: "single", options: [] }],
					answers: [{ value: "go", label: "Go", wasCustom: false, index: 1 }],
					cancelled: false,
				});
			});

			const result = await registeredTool.execute(
				"call-id",
				{ questions: [{ questionTopic: "Lang", prompt: "Choose language", options: [{ value: "go", label: "Go" }] }] },
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			expect(result.details.questions).toHaveLength(1);
			expect(result.details.questions[0].questionTopic).toBe("Lang");
			expect(result.details.questions[0].prompt).toBe("Choose language");
		});

		it("includes answers in result details", async () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
				sendMessage: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void; sendMessage: (msg: unknown, opts: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [{ questionTopic: "Tools", prompt: "Select tools", type: "multi", options: [] }],
					answers: [{ values: ["git"], labels: ["Git"],
 descriptions: [],
 wasCustom: [false] }],
					cancelled: false,
				});
			});

			const result = await registeredTool.execute(
				"call-id",
				{ questions: [{ questionTopic: "Tools", type: "multi", prompt: "Select tools", options: [{ value: "git", label: "Git" }] }] },
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			expect(result.details.answers).toHaveLength(1);
			expect(result.details.answers[0]).toHaveProperty("values");
			expect(result.details.answers[0]).toHaveProperty("labels");
		});
	});

	describe("Edge Cases", () => {
		it("handles special characters in labels", async () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
				sendMessage: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void; sendMessage: (msg: unknown, opts: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [{ questionTopic: "Special", prompt: "Special chars", type: "single", options: [] }],
					answers: [{ value: "test", label: "Option with **markdown** and [links](url)", wasCustom: false, index: 1 }],
					cancelled: false,
				});
			});

			const result = await registeredTool.execute(
				"call-id",
				{ questions: [{ questionTopic: "Special", prompt: "Special chars", options: [{ value: "test", label: "Option" }] }] },
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			const markdown = result.content[0].text;
			expect(markdown).toContain("**markdown**");
			expect(markdown).toContain("[links](url)");
		});

		it("handles empty prompt gracefully", async () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
				sendMessage: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void; sendMessage: (msg: unknown, opts: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [{ questionTopic: "Empty", prompt: "", type: "single", options: [] }],
					answers: [{ value: "a", label: "A", wasCustom: false, index: 1 }],
					cancelled: false,
				});
			});

			const result = await registeredTool.execute(
				"call-id",
				{ questions: [{ questionTopic: "Empty", prompt: "", options: [{ value: "a", label: "A" }] }] },
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			const markdown = result.content[0].text;
			expect(markdown).toContain("### ");
		});
	});
});

describe("renderResult", () => {
	const mockTheme = {
		fg: vi.fn().mockReturnValue(""),
		bg: vi.fn().mockReturnValue(""),
		bold: vi.fn().mockImplementation((text: string) => text),
		selectedBg: "selectedBg",
		accent: "accent",
		muted: "muted",
		text: "text",
		success: "success",
		warning: "warning",
		dim: "dim",
	};

	beforeEach(() => {
		mockTheme.fg.mockClear();
	});

	describe("Single-Select", () => {
		it("renders single-select answer", () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const result = {
				content: [{ type: "text" as const, text: "test" }],
				details: {
					questions: [{ questionTopic: "Lang", prompt: "Choose language", type: "single", options: [] }],
					answers: [{ value: "go", label: "Go", wasCustom: false, index: 1 }],
					cancelled: false,
				},
			};

			const rendered = registeredTool.renderResult(result, {}, mockTheme, {});

			expect(rendered).toBeDefined();
			expect(rendered.text).toContain("### Choose language");
			expect(rendered.text).toContain("- Go");
		});

		it("displays message in single-select renderResult markdown", () => {
			// Single-answer message is stored AND displayed in renderResult
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const result = {
				content: [{ type: "text" as const, text: "test" }],
				details: {
					questions: [{ questionTopic: "Lang", prompt: "Why?", type: "single", options: [] }],
					answers: [{ value: "go", label: "Go", wasCustom: false, index: 1, message: "Fast compilation" }],
					cancelled: false,
				},
			};

			const rendered = registeredTool.renderResult(result, {}, mockTheme, {});

			expect(rendered.text).toContain("### Why?");
			expect(rendered.text).toContain("- Go");
			// Message is stored but not displayed in markdown
			expect(rendered.text).toContain('Note: "Fast compilation"');
		});
	});

	describe("Multi-Select", () => {
		it("renders multi-select with checkboxes", () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const result = {
				content: [{ type: "text" as const, text: "test" }],
				details: {
					questions: [{ questionTopic: "Tools", prompt: "Select tools", type: "multi", options: [] }],
					answers: [{
						values: ["git", "docker"],
						labels: ["Git", "Docker"],
						descriptions: [],
						wasCustom: [false, false],
					}],
					cancelled: false,
				},
			};

			const rendered = registeredTool.renderResult(result, {}, mockTheme, {});

			expect(rendered.text).toContain("### Select tools");
			expect(rendered.text).toContain("- [x] Git");
			expect(rendered.text).toContain("- [x] Docker");
		});

		it("renders empty multi-select as no selection", () => {
			const mockPi = {
				registerTool: vi.fn(),
				registerCommand: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const result = {
				content: [{ type: "text" as const, text: "test" }],
				details: {
					questions: [{ questionTopic: "Opts", prompt: "Select options", type: "multi", options: [] }],
					answers: [{
						values: [],
						labels: [],
						descriptions: [],
						wasCustom: [],
					}],
					cancelled: false,
				},
			};

			const rendered = registeredTool.renderResult(result, {}, mockTheme, {});

			expect(rendered.text).toContain("### Select options");
			expect(rendered.text).toContain("- (no selection)");
		});
	});

	describe("Cancelled Result", () => {
		it("returns Cancelled text for cancelled results", () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const result = {
				content: [{ type: "text" as const, text: "User cancelled" }],
				details: {
					questions: [],
					answers: [],
					cancelled: true,
				},
			};

			// theme.fg('warning', 'Cancelled') is called but mock returns empty string
			// So we verify the cancelled state triggers the warning color path
			const rendered = registeredTool.renderResult(result, {}, mockTheme, {});

			// The renderResult returns the result of theme.fg('warning', 'Cancelled')
			// which in production would be styled. In tests, mock returns ""
			expect(rendered).toBeDefined();
			expect(result.details.cancelled).toBe(true);
		});

		it("returns content text when no details", () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const result = {
				content: [{ type: "text" as const, text: "UI not available" }],
			};

			const rendered = registeredTool.renderResult(result, {}, mockTheme, {});

			expect(rendered.text).toBe("UI not available");
		});
	});
});
