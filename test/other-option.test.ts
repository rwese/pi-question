import { describe, expect, it, vi, beforeEach } from "vitest";

// Track editor calls for verification
const editorCalls = {
	setText: [] as string[],
	handleInput: [] as string[],
	getText: "" as string,
	render: [] as string[][],
};

// Simple parseKey mock
const parseKey = (data: string) => data === 'n' ? 'n' : data;

vi.mock("@mariozechner/pi-coding-agent", () => ({
	Editor: vi.fn(),
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
	Text: vi.fn(),
	truncateToWidth: vi.fn((s: string) => s),
	wrapTextWithAnsi: vi.fn((text: string, width: number): string[] => [text]),
	visibleWidth: vi.fn((text: string): number => text.length),
}));

vi.mock("@mariozechner/pi-tui", () => ({
	parseKey: (data: string) => data === 'n' ? 'n' : data,
	Editor: vi.fn().mockImplementation(() => {
		let onSubmitCallback: ((value: string) => void) | null = null;
		let currentText = "";

		return {
			handleInput: vi.fn((data: string) => {
				editorCalls.handleInput.push(data);
				// Don't append "enter" to text
				if (data !== "enter") {
					currentText += data;
					editorCalls.getText = currentText;
				}
				// Simulate Enter triggering onSubmit
				if (data === "enter" && onSubmitCallback) {
					onSubmitCallback(currentText);
				}
			}),
			setText: vi.fn((text: string) => {
				editorCalls.setText.push(text);
				currentText = text;
				editorCalls.getText = text;
			}),
			getText: vi.fn(() => currentText),
			set onSubmit(cb: ((value: string) => void) | null) {
				onSubmitCallback = cb;
			},
			get onSubmit() {
				return onSubmitCallback;
			},
			render: vi.fn(() => editorCalls.render[editorCalls.render.length - 1] || []),
		};
	}),
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
	matchesKey: vi.fn((data: string, pattern: string) => {
		return data === pattern;
	}),
	Text: vi.fn().mockImplementation((text) => ({ text, line: 0, col: 0 })),
	truncateToWidth: vi.fn((s: string) => s),
	wrapTextWithAnsi: vi.fn((text: string, width: number): string[] => [text]),
	visibleWidth: vi.fn((text: string): number => text.length),
}));

// Import extension after mocks
import questionnaire from "../extensions/index.js";

describe("Other Option - Regression Tests", () => {
	let mockPi: any;
	let registeredTool: any;
	let capturedDone: any;
	let mockTui: any;
	let mockTheme: any;
	let handlers: any;

	beforeEach(() => {
		// Reset editor call tracking
		editorCalls.setText = [];
		editorCalls.handleInput = [];
		editorCalls.getText = "";
		editorCalls.render = [[]];

		mockPi = {
			registerTool: vi.fn(),
			registerCommand: vi.fn(),
				registerFlag: vi.fn(),
				getFlag: vi.fn(() => false),
			sendMessage: vi.fn(),
		};

		questionnaire(mockPi);
		registeredTool = mockPi.registerTool.mock.calls[0][0];

		capturedDone = null;
		mockTui = null;
		mockTheme = null;
		handlers = null;
	});

	function setupMock() {
		const mockCustom = vi.fn().mockImplementation((callback: any) => {
			mockTui = { requestRender: vi.fn() };
			mockTheme = {
				fg: vi.fn((c: string, t: string) => t),
				bg: vi.fn((c: string, t: string) => t),
				bold: vi.fn((t: string) => t),
			};

			handlers = callback(mockTui, mockTheme, {}, (result: any) => {
				capturedDone(result);
			});

			return new Promise((resolve) => {
				capturedDone = (result: any) => resolve(result);
			});
		});
		return mockCustom;
	}

	describe("Single-Select: Other Option Input Mode", () => {
		it("pressing Enter on Other should enter input mode and accept custom text", async () => {
			const mockCustom = setupMock();

			const resultPromise = registeredTool.execute(
				"call-id",
				{
					questions: [
						{
							questionTopic: "Language",
							prompt: "What is your preferred language?",
							type: "single",
							options: [
								{ value: "go", label: "Go" },
								{ value: "rust", label: "Rust" },
							],
						},
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: vi.fn() }
			);

			// Wait for handlers to be set up
			await new Promise((r) => setTimeout(r, 10));
			expect(handlers).toBeDefined();
			expect(handlers.handleInput).toBeDefined();

			// Navigate down twice to reach Other option (Go=0, Rust=1, Other=2)
			handlers.handleInput("down");
			handlers.handleInput("down");

			// Press Enter on Other - this should enter input mode and call setText('')
			handlers.handleInput("enter");

			// Verify editor.setText was called to clear for input
			expect(editorCalls.setText).toContain("");

			// Type custom input
			handlers.handleInput("C");
			handlers.handleInput("u");
			handlers.handleInput("s");
			handlers.handleInput("t");
			handlers.handleInput("o");
			handlers.handleInput("m");

			expect(editorCalls.getText).toBe("Custom");

			// Submit with Enter
			handlers.handleInput("enter");

			// Wait for result
			const result = await resultPromise;

			expect(result.details.cancelled).toBe(false);
			expect(result.details.answers).toHaveLength(1);
			const answer = result.details.answers[0] as any;
			expect(answer.value).toBe("(other)");
			expect(answer.label).toBe("Custom");
			expect(answer.wasCustom).toBe(true);
		});

		it("pressing Escape during Other input should return to option selection", async () => {
			const mockCustom = setupMock();

			const resultPromise = registeredTool.execute(
				"call-id",
				{
					questions: [
						{
							questionTopic: "Language",
							prompt: "What is your preferred language?",
							type: "single",
							options: [{ value: "go", label: "Go" }],
						},
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: vi.fn() }
			);

			await new Promise((r) => setTimeout(r, 10));

			// Navigate to Other and enter input mode
			handlers.handleInput("down"); // Go to Other (index 1)
			handlers.handleInput("enter"); // Enter input mode

			// Type something
			handlers.handleInput("T");
			handlers.handleInput("e");
			handlers.handleInput("s");
			expect(editorCalls.getText).toBe("Tes");

			// Press Escape to cancel input mode
			handlers.handleInput("escape");

			// Editor should be cleared
			expect(editorCalls.setText).toContain("");

			// Continue with a regular option
			handlers.handleInput("up"); // Go back to Go
			handlers.handleInput("enter"); // Select Go

			const result = await resultPromise;

			expect(result.details.cancelled).toBe(false);
			expect(result.details.answers).toHaveLength(1);
			const answer = result.details.answers[0] as any;
			expect(answer.value).toBe("go");
			expect(answer.wasCustom).toBe(false);
		});
	});


	describe("Regression: Other option should always be selectable", () => {
		it("Other should be selectable even with no regular options", async () => {
			const mockCustom = setupMock();

			const resultPromise = registeredTool.execute(
				"call-id",
				{
					questions: [
						{
							questionTopic: "Custom",
							prompt: "Enter a custom value",
							type: "single",
							options: [], // No predefined options
						},
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: vi.fn() }
			);

			await new Promise((r) => setTimeout(r, 10));

			// Other should be the only option (index 0)
			// Verify it's rendered
			const renderedBefore = handlers.render(80);
			expect(renderedBefore.some((line: string) => line.includes("Other"))).toBe(true);

			// Press Enter to select Other
			handlers.handleInput("enter");

			// Type custom value
			handlers.handleInput("M");
			handlers.handleInput("y");
			handlers.handleInput("V");
			handlers.handleInput("a");
			handlers.handleInput("l");
			handlers.handleInput("u");
			handlers.handleInput("e");

			expect(editorCalls.getText).toBe("MyValue");

			// Submit
			handlers.handleInput("enter");

			const result = await resultPromise;

			expect(result.details.cancelled).toBe(false);
			expect(result.details.answers).toHaveLength(1);
			const answer = result.details.answers[0] as any;
			expect(answer.value).toBe("(other)");
			expect(answer.label).toBe("MyValue");
			expect(answer.wasCustom).toBe(true);
		});

		it("Enter on Other should work immediately after question appears", async () => {
			const mockCustom = setupMock();

			const resultPromise = registeredTool.execute(
				"call-id",
				{
					questions: [
						{
							questionTopic: "Language",
							prompt: "Select language",
							type: "single",
							options: [
								{ value: "go", label: "Go" },
							],
						},
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: vi.fn() }
			);

			await new Promise((r) => setTimeout(r, 10));

			// Navigate directly to Other (down once)
			handlers.handleInput("down");

			// Immediately press Enter on Other - this is the regression test
			handlers.handleInput("enter");

			// Verify input mode is active
			expect(editorCalls.setText).toContain("");

			// Type and submit
			handlers.handleInput("Z");
			handlers.handleInput("i");
			handlers.handleInput("g");

			expect(editorCalls.getText).toBe("Zig");

			handlers.handleInput("enter");

			const result = await resultPromise;

			expect(result.details.cancelled).toBe(false);
			const answer = result.details.answers[0] as any;
			expect(answer.value).toBe("(other)");
			expect(answer.label).toBe("Zig");
		});
	});

	describe("Regression: Other option should not appear twice", () => {
		it("should filter out 'Other' if model includes it in options", async () => {
			const mockCustom = setupMock();

			const resultPromise = registeredTool.execute(
				"call-id",
				{
					questions: [
						{
							questionTopic: "Language",
							prompt: "Select a language",
							type: "single",
							options: [
								{ value: "go", label: "Go" },
								{ value: "other", label: "Other" }, // Model accidentally included this
							],
						},
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: vi.fn() }
			);

			await new Promise((r) => setTimeout(r, 10));

			// Render the question
			const rendered = handlers.render(80);
			// Should only have ONE "Other" (the auto-appended one)
			const otherCount = rendered.filter((line: string) => line.includes("Other")).length;
			expect(otherCount).toBe(1);

			// Go should appear exactly once (not duplicated as "other" from model options)
				const goLines = rendered.filter((line: string) => line.includes("Go"));
				expect(goLines.length).toBe(1);

			// Clean up
			handlers.handleInput("escape");
			const result = await resultPromise;
			expect(result.details.cancelled).toBe(true);
		});

		it("should filter out 'other' (case-insensitive) from model options", async () => {
			const mockCustom = setupMock();

			const resultPromise = registeredTool.execute(
				"call-id",
				{
					questions: [
						{
							questionTopic: "Language",
							prompt: "Select a language",
							type: "single",
							options: [
								{ value: "go", label: "Go" },
								{ value: "rust", label: "Rust" },
								{ value: "custom", label: "other" }, // lowercase "other"
							],
						},
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: vi.fn() }
			);

			await new Promise((r) => setTimeout(r, 10));

			// Should have: Go, Rust, Other (auto) = 3 options total
			// "other" should be filtered out
			const rendered = handlers.render(80);

			// Verify Go and Rust are present
			expect(rendered.some((line: string) => line.includes("Go"))).toBe(true);
			expect(rendered.some((line: string) => line.includes("Rust"))).toBe(true);

			// Should only have one "Other" line
			const otherLines = rendered.filter((line: string) => line.includes("Other"));
			expect(otherLines.length).toBe(1);

			// Clean up
			handlers.handleInput("escape");
			await resultPromise;
		});
	});
});
