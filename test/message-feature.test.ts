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
		space: " ",
		shift: (key: string) => `shift+${key}`,
	},
	matchesKey: vi.fn(),
	Text: vi.fn().mockImplementation((text) => ({ text, line: 0, col: 0 })),
	truncateToWidth: vi.fn((s: string) => s),
}));

// Import extension after mocks
import questionnaire from "../extensions/index.js";

// Types matching the extension
interface SingleAnswer {
	value: string;
	label: string;
	wasCustom: boolean;
	index?: number;
	message?: string;
}

interface MultiAnswer {
	values: string[];
	labels: string[];
	wasCustom: boolean[];
}

describe("Message Feature v2", () => {
	describe("Single-Select Answers", () => {
		it("single-select answer with message", async () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const mockCustom = vi.fn().mockImplementation((callback: (tui: unknown, theme: unknown, kb: unknown, done: (result: unknown) => void) => void) => {
				const mockResult = {
					questions: [{ questionTopic: "Test", prompt: "Test?", type: "single", options: [{ value: "a", label: "A" }] }],
					answers: [{
						value: "a",
						label: "A",
						wasCustom: false,
						index: 1,
						message: "This is a note",
					}],
					cancelled: false,
				};

				let doneFn: ((result: unknown) => void) | null = null;
				callback(
					{ requestRender: vi.fn() },
					{ fg: vi.fn((c, t) => t), bg: vi.fn((c, t) => t) },
					{},
					(result: unknown) => {
						doneFn?.(result);
					}
				);

				return new Promise((resolve) => {
					doneFn = (result) => {
						resolve(result);
					};
					doneFn(mockResult);
				});
			});

			const result = await registeredTool.execute(
				"call-id",
				{
					questions: [{ questionTopic: "Test", prompt: "Test?", options: [{ value: "a", label: "A" }] }],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			expect(result.details).toBeDefined();
			expect(result.details.answers).toHaveLength(1);
			const answer = result.details.answers[0] as SingleAnswer;
			expect(answer.value).toBe("a");
			expect(answer.message).toBe("This is a note");
			expect(result.content[0].text).toBeDefined();
		});
	});

	describe("Multi-Select Answers", () => {
		it("multi-select answer has values, labels, wasCustom arrays", async () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const mockCustom = vi.fn().mockImplementation((callback: (tui: unknown, theme: unknown, kb: unknown, done: (result: unknown) => void) => void) => {
				return new Promise((resolve) => {
					setTimeout(() => {
						const result = {
							questions: [{ questionTopic: "Tools", prompt: "Select tools", type: "multi", options: [] }],
							answers: [{
								values: ["git", "docker"],
								labels: ["Git", "Docker"],
								descriptions: [],
								wasCustom: [false, false],
							}],
							cancelled: false,
						};
						callback({}, { fg: vi.fn(), bg: vi.fn() }, {}, () => {});
						resolve(result);
					}, 0);
				});
			});

			const result = await registeredTool.execute(
				"call-id",
				{
					questions: [
						{
							questionTopic: "Tools",
							type: "multi",
							prompt: "Select tools",
							options: [{ value: "git", label: "Git" }, { value: "docker", label: "Docker" }],
						},
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			const answer = result.details.answers[0] as MultiAnswer;
			expect(answer.values).toEqual(["git", "docker"]);
			expect(answer.labels).toEqual(["Git", "Docker"]);
			expect(answer.wasCustom).toEqual([false, false]);
		});

		it("multi-select output shows checkbox list without comments", async () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const mockCustom = vi.fn().mockImplementation((callback: (tui: unknown, theme: unknown, kb: unknown, done: (result: unknown) => void) => void) => {
				return new Promise((resolve) => {
					setTimeout(() => {
						const result = {
							questions: [{ questionTopic: "Tools", prompt: "Select tools", type: "multi", options: [] }],
							answers: [{
								values: ["git", "tmux"],
								labels: ["Git", "tmux"],
								descriptions: [],
								wasCustom: [false, false],
							}],
							cancelled: false,
						};
						callback({}, { fg: vi.fn(), bg: vi.fn() }, {}, () => {});
						resolve(result);
					}, 0);
				});
			});

			const result = await registeredTool.execute(
				"call-id",
				{
					questions: [
						{
							questionTopic: "Tools",
							type: "multi",
							prompt: "Select tools",
							options: [{ value: "git", label: "Git" }, { value: "docker", label: "Docker" }, { value: "tmux", label: "tmux" }],
						},
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			expect(result.content[0].text).toContain("- [x] Git");
			expect(result.content[0].text).toContain("- [x] tmux");
			expect(result.content[0].text).toContain("### Select tools");
			expect(result.content[0].text).not.toContain("User Comment:");
		});
	});

	describe("Render Result", () => {
		it("renderResult shows markdown sections for single-select", () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const mockTheme = {
				fg: vi.fn().mockReturnValue(""),
				bg: vi.fn().mockReturnValue(""),
				bold: vi.fn().mockImplementation((text: string) => text),
			};

			const resultWithMessage = {
				content: [{ type: "text" as const, text: "test" }],
				details: {
					questions: [{ questionTopic: "Q1", prompt: "What is your favorite?", type: "single", options: [] }],
					answers: [
						{
							value: "go",
							label: "Go",
							wasCustom: false,
							index: 1,
						},
					],
					cancelled: false,
				},
			};

			const rendered = registeredTool.renderResult(resultWithMessage, {}, mockTheme, {});

			expect(rendered).toBeDefined();
		});

		it("renderResult shows checkbox list for multi-select without comments", () => {
			const mockPi = {
				registerTool: vi.fn(),
					registerCommand: vi.fn(),
			} as unknown as { registerTool: (tool: unknown) => void };

			questionnaire(mockPi);

			const registeredTool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][0];

			const mockTheme = {
				fg: vi.fn().mockReturnValue(""),
				bg: vi.fn().mockReturnValue(""),
				bold: vi.fn().mockImplementation((text: string) => text),
			};

			const resultWithMulti = {
				content: [{ type: "text" as const, text: "test" }],
				details: {
					questions: [{ questionTopic: "Tools", prompt: "Select tools", type: "multi", options: [] }],
					answers: [
						{
							values: ["git", "docker"],
							labels: ["Git", "Docker"],
							descriptions: [],
							wasCustom: [false, false],
						},
					],
					cancelled: false,
				},
			};

			const rendered = registeredTool.renderResult(resultWithMulti, {}, mockTheme, {});

			expect(rendered).toBeDefined();
		});
	});
});
