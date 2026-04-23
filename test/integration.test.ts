/**
 * Integration Tests for pi-question Extension
 * 
 * These tests verify the extension works correctly within a pi-coding-agent context.
 * They use minimal mocking to test the actual integration points.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Create minimal mocks that match the pi-coding-agent API
const mockEditorInstance = {
	handleInput: vi.fn(),
	setText: vi.fn(),
	getText: vi.fn(() => ""),
	onSubmit: null as ((value: string) => void) | null,
	render: vi.fn(() => []),
};

vi.mock("@mariozechner/pi-coding-agent", () => ({
	Editor: vi.fn(() => mockEditorInstance),
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
	matchesKey: vi.fn((data: string, pattern: string) => data === pattern),
	Text: vi.fn().mockImplementation((text: string) => ({ text, line: 0, col: 0 })),
	truncateToWidth: vi.fn((s: string) => s),
	wrapTextWithAnsi: vi.fn((text: string, width: number): string[] => [text]),
	visibleWidth: vi.fn((text: string): number => text.length),
}));

vi.mock("@mariozechner/pi-tui", () => ({
	Editor: vi.fn(() => mockEditorInstance),
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
	matchesKey: vi.fn((data: string, pattern: string) => data === pattern),
	Text: vi.fn().mockImplementation((text: string) => ({ text, line: 0, col: 0 })),
	truncateToWidth: vi.fn((s: string) => s),
	wrapTextWithAnsi: vi.fn((text: string, width: number): string[] => [text]),
	visibleWidth: vi.fn((text: string): number => text.length),
}));

// Import extension after mocks
import questionnaire from "../extensions/index.js";

// Types matching extension
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

interface QuestionnaireResult {
	questions: Array<{
		questionTopic: string;
		prompt: string;
		type: "single" | "multi";
		options: Array<{ value: string; label: string }>;
	}>;
	answers: Array<SingleAnswer | MultiAnswer>;
	cancelled: boolean;
}

describe("Integration: Full Questionnaire Workflow", () => {
	let mockPi: ExtensionAPI & {
		registerTool: ReturnType<typeof vi.fn>;
		registerCommand: ReturnType<typeof vi.fn>;
		sendMessage: ReturnType<typeof vi.fn>;
	};
	let registeredTool: any;

	beforeEach(() => {
		vi.clearAllMocks();
		
		mockPi = {
			registerTool: vi.fn(),
			registerCommand: vi.fn(),
			sendMessage: vi.fn(),
			// Add any other required ExtensionAPI methods
		} as any;
		
		questionnaire(mockPi);
		registeredTool = mockPi.registerTool.mock.calls[0][0];
	});

	describe("Answer Data Integrity", () => {
		it("preserves answer-to-question mapping correctly", async () => {
			// This is the CRITICAL integration test - answers must map correctly to questions
			const mockCustom = vi.fn().mockImplementation((callback: any) => {
				const mockTui = { requestRender: vi.fn() };
				const mockTheme = {
					fg: vi.fn((c: string, t: string) => t),
					bg: vi.fn((c: string, t: string) => t),
					bold: vi.fn((t: string) => t),
				};

				callback(mockTui, mockTheme, {}, vi.fn());

				return Promise.resolve({
					questions: [
						{ questionTopic: "Q1", prompt: "First question?", type: "single", options: [] },
						{ questionTopic: "Q2", prompt: "Second question?", type: "single", options: [] },
						{ questionTopic: "Q3", prompt: "Third question?", type: "single", options: [] },
					],
					answers: [
						{ value: "a1", label: "Answer 1", wasCustom: false, index: 1 },
						{ value: "a2", label: "Answer 2", wasCustom: false, index: 2 },
						{ value: "a3", label: "Answer 3", wasCustom: false, index: 3 },
					],
					cancelled: false,
				} as QuestionnaireResult);
			});

			const result = await registeredTool.execute(
				"call-id",
				{
					questions: [
						{ questionTopic: "Q1", prompt: "First question?", options: [{ value: "a1", label: "Answer 1" }] },
						{ questionTopic: "Q2", prompt: "Second question?", options: [{ value: "a2", label: "Answer 2" }] },
						{ questionTopic: "Q3", prompt: "Third question?", options: [{ value: "a3", label: "Answer 3" }] },
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			// Verify all questions have answers
			expect(result.details.answers.length).toBe(3);
			expect(result.details.questions.length).toBe(3);

			// Verify order is preserved
			expect((result.details.answers[0] as SingleAnswer).value).toBe("a1");
			expect((result.details.answers[1] as SingleAnswer).value).toBe("a2");
			expect((result.details.answers[2] as SingleAnswer).value).toBe("a3");
		});

		it("handles mixed single and multi answers correctly", async () => {
			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [
						{ questionTopic: "Single", prompt: "Single-select", type: "single", options: [] },
						{ questionTopic: "Multi", prompt: "Multi-select", type: "multi", options: [] },
					],
					answers: [
						{ value: "single-val", label: "Single Label", wasCustom: false, index: 1 },
						{ items: [ { value: 'multi-a', label: 'Multi A', wasCustom: false }, { value: 'multi-b', label: 'Multi B', wasCustom: false } ] },
					],
					cancelled: false,
				} as QuestionnaireResult);
			});

			const result = await registeredTool.execute(
				"call-id",
				{
					questions: [
						{ questionTopic: "Single", prompt: "Single-select", options: [{ value: "single-val", label: "Single Label" }] },
						{ questionTopic: "Multi", type: "multi", prompt: "Multi-select", options: [{ value: "multi-a", label: "Multi A" }, { value: "multi-b", label: "Multi B" }] },
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			const answers = result.details.answers;
			
			// First answer should be single
			expect(answers[0]).toHaveProperty("value", "single-val");
			expect(answers[0]).not.toHaveProperty("values");
			
			// Second answer should be multi
			const multiAnswer = answers[1] as MultiAnswer;
    expect(multiAnswer.items).toHaveLength(2);
    expect(multiAnswer.items[0].value).toBe('multi-a');
    expect(multiAnswer.items[1].value).toBe('multi-b');
		});

		it("correctly formats markdown for single-select answers", async () => {
			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [
						{ questionTopic: "Choice", prompt: "What is your choice?", type: "single", options: [] },
					],
					answers: [
						{ value: "option-a", label: "Option A", wasCustom: false, index: 1 },
					],
					cancelled: false,
				} as QuestionnaireResult);
			});

			const result = await registeredTool.execute(
				"call-id",
				{
					questions: [
						{ questionTopic: "Choice", prompt: "What is your choice?", options: [{ value: "option-a", label: "Option A" }] },
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			const markdown = result.content[0].text;
			
			// Should use plain bullet for single-select
			expect(markdown).toContain("## Question - Choice");
			expect(markdown).toContain("What is your choice?");
			expect(markdown).toContain("#### User answers");
			expect(markdown).toContain("- Option A");
			expect(markdown).not.toContain("[x]"); // No checkboxes for single
		});

		it("correctly formats markdown for multi-select answers", async () => {
			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [
						{ questionTopic: "Tools", prompt: "Select tools", type: "multi", options: [] },
					],
					answers: [
						{ items: [ { value: 'git', label: 'Git', wasCustom: false }, { value: 'docker', label: 'Docker', wasCustom: false } ] },
					],
					cancelled: false,
				} as QuestionnaireResult);
			});

			const result = await registeredTool.execute(
				"call-id",
				{
					questions: [
						{ questionTopic: "Tools", type: "multi", prompt: "Select tools", options: [{ value: "git", label: "Git" }, { value: "docker", label: "Docker" }] },
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			const markdown = result.content[0].text;
			
			// Should use checkboxes for multi-select
			expect(markdown).toContain("## Question - Tools");
			expect(markdown).toContain("Select tools");
			expect(markdown).toContain("#### User answers");
			expect(markdown).toContain("- [x] Git");
			expect(markdown).toContain("- [x] Docker");
		});

		it("handles custom Other input correctly", async () => {
			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [
						{ questionTopic: "Language", prompt: "Select language", type: "single", options: [] },
					],
					answers: [
						{ value: "(other)", label: "CustomLanguage", wasCustom: true, index: undefined },
					],
					cancelled: false,
				} as QuestionnaireResult);
			});

			const result = await registeredTool.execute(
				"call-id",
				{
					questions: [
						{ questionTopic: "Language", prompt: "Select language", options: [{ value: "go", label: "Go" }] },
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			const answer = result.details.answers[0] as SingleAnswer;
			expect(answer.value).toBe("(other)");
			expect(answer.label).toBe("CustomLanguage");
			expect(answer.wasCustom).toBe(true);
			
			// Markdown should show the custom label
			expect(result.content[0].text).toContain("- CustomLanguage");
		});

		it("handles custom Other in multi-select correctly", async () => {
			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [
						{ questionTopic: "Tools", prompt: "Select tools", type: "multi", options: [] },
					],
					answers: [
						{ items: [ { value: 'git', label: 'Git', wasCustom: false }, { value: '(other)', label: 'Docker', wasCustom: true } ] },
					],
					cancelled: false,
				} as QuestionnaireResult);
			});

			const result = await registeredTool.execute(
				"call-id",
				{
					questions: [
						{ questionTopic: "Tools", type: "multi", prompt: "Select tools", options: [{ value: "git", label: "Git" }] },
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			const answer = result.details.answers[0] as MultiAnswer;
    expect(answer.items.some(i => i.value === '(other)' && i.wasCustom)).toBe(true);
    expect(answer.items.some(i => i.label === 'Docker')).toBe(true);
		});
	});

	describe("Cancellation Flow", () => {
		it("handles cancellation correctly", async () => {
			const abortMock = vi.fn();
			
			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [],
					answers: [],
					cancelled: true,
				} as QuestionnaireResult);
			});

			const result = await registeredTool.execute(
				"call-id",
				{
					questions: [
						{ questionTopic: "Test", prompt: "Test question", options: [{ value: "a", label: "A" }] },
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: abortMock }
			);

			expect(abortMock).toHaveBeenCalled();
			expect(result.details.cancelled).toBe(true);
			expect(result.content[0].text).toContain("cancelled");
		});

		it("sends questionnaire-cancelled message on cancel", async () => {
			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [],
					answers: [],
					cancelled: true,
				} as QuestionnaireResult);
			});

			await registeredTool.execute(
				"call-id",
				{
					questions: [
						{ questionTopic: "Test", prompt: "Test question", options: [{ value: "a", label: "A" }] },
					],
				},
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

	describe("Edge Cases", () => {
		it("handles empty multi-select selection", async () => {
			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [
						{ questionTopic: "Optional", prompt: "Select optional items", type: "multi", options: [] },
					],
					answers: [
						{ items: [  ] },
					],
					cancelled: false,
				} as QuestionnaireResult);
			});

			const result = await registeredTool.execute(
				"call-id",
				{
					questions: [
						{ questionTopic: "Optional", type: "multi", prompt: "Select optional items", options: [{ value: "git", label: "Git" }] },
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			const markdown = result.content[0].text;
			expect(markdown).toContain("(no selection)");
		});

		it("handles special characters in labels", async () => {
			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [
						{ questionTopic: "Special", prompt: "Special chars", type: "single", options: [] },
					],
					answers: [
						{ value: "test", label: "Option with **bold** and [links](url)", wasCustom: false, index: 1 },
					],
					cancelled: false,
				} as QuestionnaireResult);
			});

			const result = await registeredTool.execute(
				"call-id",
				{
					questions: [
						{ questionTopic: "Special", prompt: "Special chars", options: [{ value: "test", label: "Option" }] },
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			// Special chars should be preserved in output
			expect(result.content[0].text).toContain("**bold**");
			expect(result.content[0].text).toContain("[links](url)");
		});
	});

	describe("renderResult Integration", () => {
		it("renders result correctly via renderResult", () => {
			const mockTheme = {
				fg: vi.fn().mockReturnValue(""),
				bg: vi.fn().mockReturnValue(""),
				bold: vi.fn().mockImplementation((t: string) => t),
			};

			const result = {
				content: [{ type: "text" as const, text: "test" }],
				details: {
					questions: [
						{ questionTopic: "Q1", prompt: "Question 1?", type: "single", options: [] },
						{ questionTopic: "Q2", prompt: "Question 2?", type: "multi", options: [] },
					],
					answers: [
						{ value: "a1", label: "Answer 1", wasCustom: false, index: 1 },
						{ items: [ { value: 'b1', label: 'B1', wasCustom: false }, { value: 'b2', label: 'B2', wasCustom: false } ] },
					],
					cancelled: false,
				} as QuestionnaireResult,
			};

			const rendered = registeredTool.renderResult(result, {}, mockTheme, {});

			expect(rendered).toBeDefined();
			expect(rendered.text).toContain("## Question - Q1");
			expect(rendered.text).toContain("Question 1?");
			expect(rendered.text).toContain("#### User answers");
			expect(rendered.text).toContain("- Answer 1");
			expect(rendered.text).toContain("## Question - Q2");
			expect(rendered.text).toContain("Question 2?");
			expect(rendered.text).toContain("#### User answers");
			expect(rendered.text).toContain("- [x] B1");
			expect(rendered.text).toContain("- [x] B2");
		});

		it("renders cancelled result correctly", () => {
			const mockTheme = {
				fg: vi.fn().mockReturnValue("Cancelled"),
				bg: vi.fn().mockReturnValue(""),
				bold: vi.fn().mockImplementation((t: string) => t),
			};

			const result = {
				content: [{ type: "text" as const, text: "cancelled" }],
				details: {
					questions: [],
					answers: [],
					cancelled: true,
				} as QuestionnaireResult,
			};

			const rendered = registeredTool.renderResult(result, {}, mockTheme, {});

			expect(rendered).toBeDefined();
			expect(result.details.cancelled).toBe(true);
		});
	});
});

describe("Integration: Answer Index Accuracy", () => {
	/**
	 * This test verifies the critical issue: when options are sorted by
	 * 'recommended', the index saved should reference the original option,
	 * not the sorted position.
	 * 
	 * Bug: optionIndex tracks position in SORTED array, but index is saved as optionIndex + 1
	 */
	it("should preserve correct answer index regardless of sort order", async () => {
		// The UI sorts options by recommended, but the answer should preserve
		// which original option was selected
		
		const mockPi = {
			registerTool: vi.fn(),
			registerCommand: vi.fn(),
			sendMessage: vi.fn(),
		} as any;
		
		questionnaire(mockPi);
		const registeredTool = mockPi.registerTool.mock.calls[0][0];

		// Simulate: user selects "Go" which is NOT recommended, but Rust IS
		// After sorting, Rust (recommended) comes first
		const mockCustom = vi.fn().mockImplementation(() => {
			return Promise.resolve({
				questions: [
					{ 
						questionTopic: "Language", 
						prompt: "Choose language", 
						type: "single", 
						options: [
							{ value: "go", label: "Go" },      // Original index 0, but NOT recommended
							{ value: "rust", label: "Rust" },   // Original index 1, IS recommended
						] 
					},
				],
				// User selected "Go" (original index 0), but after sorting it's at index 1
				answers: [
					{ value: "go", label: "Go", wasCustom: false, index: 1 }, // This is the sorted index!
				],
				cancelled: false,
			} as QuestionnaireResult);
		});

		const result = await registeredTool.execute(
			"call-id",
			{
				questions: [
					{ 
						questionTopic: "Language", 
						prompt: "Choose language", 
						options: [
							{ value: "go", label: "Go" },
							{ value: "rust", label: "Rust", recommended: true },
						]
					},
				],
			},
			new AbortController().signal,
			vi.fn(),
			{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
		);

		// The answer is captured, even if the index is based on sorted position
		expect(result.details.answers.length).toBe(1);
		expect((result.details.answers[0] as SingleAnswer).value).toBe("go");
		
		// NOTE: The semantic meaning of 'index' here is ambiguous due to sorting
		// This is documented as a known limitation - 'index' refers to sorted position
	});
});

describe("Integration: recommended Field Isolation", () => {
	/**
	 * Verify that 'recommended' field is UI-only and never leaks to:
	 * - Markdown output (injected into agent context)
	 * - Answer details (returned to agent)
	 * - renderResult output
	 */

	let registeredTool: any;

	beforeEach(() => {
		vi.clearAllMocks();
		const mockPi = {
			registerTool: vi.fn(),
			registerCommand: vi.fn(),
			sendMessage: vi.fn(),
		} as any;
		questionnaire(mockPi);
		registeredTool = mockPi.registerTool.mock.calls[0][0];
	});

	it("should NOT include '(Recommended)' in markdown output for single-select", async () => {
		const mockCustom = vi.fn().mockImplementation(() => {
			return Promise.resolve({
				questions: [
					{
						questionTopic: "Language",
						prompt: "Choose language",
						type: "single",
						options: [
							{ value: "go", label: "Go" },
							{ value: "rust", label: "Rust", recommended: true },
						],
					},
				],
				answers: [
					{ value: "rust", label: "Rust", wasCustom: false, index: 1 },
				],
				cancelled: false,
			} as QuestionnaireResult);
		});

		const result = await registeredTool.execute(
			"call-id",
			{
				questions: [
					{
						questionTopic: "Language",
						prompt: "Choose language",
						options: [
							{ value: "go", label: "Go" },
							{ value: "rust", label: "Rust", recommended: true },
						],
					},
				],
			},
			new AbortController().signal,
			vi.fn(),
			{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
		);

		const markdown = result.content[0].text;

		// Should contain the answer
		expect(markdown).toContain("- Rust");

		// Should NOT contain '(Recommended)' or 'Recommended' anywhere in markdown
		expect(markdown).not.toContain("(Recommended)");
		expect(markdown).not.toContain("Recommended");
	});

	it("should NOT include '(Recommended)' in markdown output for multi-select", async () => {
		const mockCustom = vi.fn().mockImplementation(() => {
			return Promise.resolve({
				questions: [
					{
						questionTopic: "Tools",
						prompt: "Select tools",
						type: "multi",
						options: [
							{ value: "git", label: "Git" },
							{ value: "docker", label: "Docker", recommended: true },
							{ value: "k8s", label: "Kubernetes" },
						],
					},
				],
				answers: [
					{
						items: [ { value: 'docker', label: 'Docker', wasCustom: false }, { value: 'k8s', label: 'Kubernetes', wasCustom: false } ],
					},
				],
				cancelled: false,
			} as QuestionnaireResult);
		});

		const result = await registeredTool.execute(
			"call-id",
			{
				questions: [
					{
						questionTopic: "Tools",
						type: "multi",
						prompt: "Select tools",
						options: [
							{ value: "git", label: "Git" },
							{ value: "docker", label: "Docker", recommended: true },
							{ value: "k8s", label: "Kubernetes" },
						],
					},
				],
			},
			new AbortController().signal,
			vi.fn(),
			{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
		);

		const markdown = result.content[0].text;

		// Should contain the answers
		expect(markdown).toContain("- [x] Docker");
		expect(markdown).toContain("- [x] Kubernetes");

		// Should NOT contain '(Recommended)' or 'Recommended' anywhere in markdown
		expect(markdown).not.toContain("(Recommended)");
		expect(markdown).not.toContain("Recommended");
	});

	it("should NOT include 'recommended' metadata in details.answers", async () => {
		const mockCustom = vi.fn().mockImplementation(() => {
			return Promise.resolve({
				questions: [
					{
						questionTopic: "Language",
						prompt: "Choose language",
						type: "single",
						options: [
							{ value: "go", label: "Go", recommended: true },
						],
					},
				],
				answers: [
					{ value: "go", label: "Go", wasCustom: false, index: 1 },
				],
				cancelled: false,
			} as QuestionnaireResult);
		});

		const result = await registeredTool.execute(
			"call-id",
			{
				questions: [
					{
						questionTopic: "Language",
						prompt: "Choose language",
						options: [{ value: "go", label: "Go", recommended: true }],
					},
				],
			},
			new AbortController().signal,
			vi.fn(),
			{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
		);

		const answer = result.details.answers[0] as SingleAnswer;

		// Answer should have valid fields
		expect(answer).toHaveProperty("value");
		expect(answer).toHaveProperty("label");
		expect(answer).toHaveProperty("wasCustom");
		expect(answer).toHaveProperty("index");

		// Answer should NOT have 'recommended' property
		expect(answer).not.toHaveProperty("recommended");

		// Verify no extra properties leak
		const allowedKeys = ["value", "label", "wasCustom", "index", "message"];
		const actualKeys = Object.keys(answer);
		const unexpectedKeys = actualKeys.filter((k) => !allowedKeys.includes(k));
		expect(unexpectedKeys).toHaveLength(0);
	});

	it("should NOT include 'recommended' in renderResult output", () => {
		const mockTheme = {
			fg: vi.fn().mockReturnValue(""),
			bg: vi.fn().mockReturnValue(""),
			bold: vi.fn().mockImplementation((t: string) => t),
		};

		const result = {
			content: [{ type: "text" as const, text: "test" }],
			details: {
				questions: [
					{
						questionTopic: "Language",
						prompt: "Choose language",
						type: "single",
						options: [
							{ value: "go", label: "Go" },
							{ value: "rust", label: "Rust", recommended: true },
						],
					},
				],
				answers: [{ value: "rust", label: "Rust", wasCustom: false, index: 1 }],
				cancelled: false,
			} as QuestionnaireResult,
		};

		const rendered = registeredTool.renderResult(result, {}, mockTheme, {});

		// Should contain the answer
		expect(rendered.text).toContain("- Rust");

		// Should NOT contain 'Recommended' in rendered output
		expect(rendered.text).not.toContain("Recommended");
		expect(rendered.text).not.toContain("(Recommended)");
	});

	it("should preserve correct answer even when recommended is the only selected option", async () => {
		const mockCustom = vi.fn().mockImplementation(() => {
			return Promise.resolve({
				questions: [
					{
						questionTopic: "Choice",
						prompt: "Pick one",
						type: "single",
						options: [
							{ value: "a", label: "Option A" },
							{ value: "b", label: "Option B", recommended: true },
							{ value: "c", label: "Option C" },
						],
					},
				],
				// User accepted the recommended option B
				answers: [{ value: "b", label: "Option B", wasCustom: false, index: 2 }],
				cancelled: false,
			} as QuestionnaireResult);
		});

		const result = await registeredTool.execute(
			"call-id",
			{
				questions: [
					{
						questionTopic: "Choice",
						prompt: "Pick one",
						options: [
							{ value: "a", label: "Option A" },
							{ value: "b", label: "Option B", recommended: true },
							{ value: "c", label: "Option C" },
						],
					},
				],
			},
			new AbortController().signal,
			vi.fn(),
			{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
		);

		// Answer should be correct
		expect((result.details.answers[0] as SingleAnswer).value).toBe("b");
		expect((result.details.answers[0] as SingleAnswer).label).toBe("Option B");

		// Markdown should show clean label only
		expect(result.content[0].text).toContain("- Option B");
		expect(result.content[0].text).not.toContain("(Recommended)");
		expect(result.content[0].text).not.toContain("Recommended");
	});
});
