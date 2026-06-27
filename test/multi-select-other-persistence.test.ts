/**
 * Tests for Multi-Select Other Persistence
 *
 * Regression: entering a custom "Other" value in a multi-select question and
 * re-confirming the question (after navigating away and back) must not drop
 * the Other item from the saved answer.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Self-contained TUI mocks (don't use helpers.setupTuiMocks() — it would
// override this file's editor mock with a simpler one).
vi.mock('@mariozechner/pi-coding-agent', () => ({
	ExtensionAPI: class {},
}));

const editorState = vi.hoisted(() => ({
	setTextCalls: [] as string[],
	getText: '',
}));

vi.mock('@mariozechner/pi-tui', () => ({
	Editor: vi.fn().mockImplementation(() => {
		let onSubmitCb: ((value: string) => void) | null = null;
		let currentText = '';
		return {
			handleInput: vi.fn((data: string) => {
				if (data === 'enter') {
					onSubmitCb?.(currentText);
					return;
				}
				currentText += data;
				editorState.getText = currentText;
			}),
			setText: vi.fn((text: string) => {
				editorState.setTextCalls.push(text);
				currentText = text;
				editorState.getText = text;
			}),
			getText: vi.fn(() => currentText),
			set onSubmit(cb: ((value: string) => void) | null) {
				onSubmitCb = cb;
			},
			get onSubmit() {
				return onSubmitCb;
			},
			render: vi.fn(() => []),
		};
	}),
	Key: {
		up: 'up',
		down: 'down',
		enter: 'enter',
		escape: 'escape',
		tab: 'tab',
		left: 'left',
		right: 'right',
		space: ' ',
		shift: (k: string) => `shift+${k}`,
	},
	matchesKey: vi.fn((data: string, pattern: string) => data === pattern),
	parseKey: vi.fn((data: string) => data),
	Text: vi.fn().mockImplementation((text: string) => ({ text, line: 0, col: 0 })),
	truncateToWidth: vi.fn((s: string) => s),
	wrapTextWithAnsi: vi.fn((text: string, _w: number): string[] => [text]),
	visibleWidth: vi.fn((text: string) => text.length),
}));

import questionnaire from '../extensions/index.js';

interface MultiAnswer {
	items: Array<{
		value: string;
		label: string;
		wasCustom: boolean;
		note?: string;
	}>;
}

const multiQuestion = {
	questionTopic: 'Tools',
	prompt: 'Select tools',
	type: 'multi' as const,
	options: [
		{ value: 'git', label: 'Git' },
		{ value: 'docker', label: 'Docker' },
	],
};

const singleQuestion = {
	questionTopic: 'Lang',
	prompt: 'Pick a language',
	type: 'single' as const,
	options: [{ value: 'go', label: 'Go' }],
};

function createMockPi() {
	return {
		registerTool: vi.fn(),
		registerCommand: vi.fn(),
		registerFlag: vi.fn(),
		getFlag: vi.fn(() => false),
		sendMessage: vi.fn(),
	};
}

function createMockTui() {
	return { requestRender: vi.fn() };
}

function createMockTheme() {
	return {
		fg: vi.fn((_c: string, t: string) => t),
		bg: vi.fn((_c: string, t: string) => t),
		bold: vi.fn((t: string) => t),
	};
}

interface Handlers {
	render: (width: number) => string[];
	handleInput: (key: string) => void;
	invalidate: () => void;
}

describe('Multi-Select: Other persistence on re-confirm', () => {
	let registeredTool: ReturnType<typeof vi.fn>['mock']['calls'][0][0];
	let handlers: Handlers | null;
	let resolveDone: ((result: unknown) => void) | null;

	beforeEach(() => {
		editorState.setTextCalls = [];
		editorState.getText = '';

		const mockPi = createMockPi();
		questionnaire(mockPi);
		registeredTool = mockPi.registerTool.mock.calls[0][0];

		handlers = null;
		resolveDone = null;
	});

	function setupExecute(questions: unknown[]) {
		const mockCustom = vi.fn().mockImplementation((callback: (...args: unknown[]) => void) => {
			handlers = callback(createMockTui(), createMockTheme(), {}, (result: unknown) => {
				resolveDone?.(result);
			}) as Handlers;
			return new Promise((resolve) => {
				resolveDone = (result: unknown) => resolve(result);
			});
		});
		return registeredTool.execute(
			'call-id',
			{ questions },
			new AbortController().signal,
			vi.fn(),
			{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: vi.fn() },
		);
	}

	async function waitForHandlers() {
		for (let i = 0; i < 50 && !handlers; i++) {
			await new Promise((r) => setTimeout(r, 5));
		}
		if (!handlers) throw new Error('handlers never set');
	}

	// Cursor layout for multiQuestion: Git=0, Docker=1, Other=2.
	// Cursor layout for singleQuestion (single-select): Go=0, Other=1.
	function typeOther(label: string, cursorMovesToOther: number) {
		for (let i = 0; i < cursorMovesToOther; i++) handlers!.handleInput('down');
		handlers!.handleInput('enter'); // enter input mode
		for (const ch of label) handlers!.handleInput(ch);
		handlers!.handleInput('enter'); // submit
	}

	it('preserves Other when re-confirming the same single-question form', async () => {
		const resultPromise = setupExecute([multiQuestion]);
		await waitForHandlers();

		handlers!.handleInput(' '); // toggle Git (Key.space === ' ')
		typeOther('Custom Tool', 2); // move 2x to reach Other

		const result = (await resultPromise) as {
			details: { answers: MultiAnswer[]; cancelled: boolean };
		};
		expect(result.details.cancelled).toBe(false);
		const items = result.details.answers[0].items;
		expect(items).toHaveLength(2);
		expect(items.some((i) => i.value === 'git')).toBe(true);
		const otherItem = items.find((i) => i.value === '(other)');
		expect(otherItem).toBeDefined();
		expect(otherItem?.label).toBe('Custom Tool');
		expect(otherItem?.wasCustom).toBe(true);
	});

	it('preserves Other through navigate-back + re-confirm in a multi-question form', async () => {
		const resultPromise = setupExecute([multiQuestion, singleQuestion]);
		await waitForHandlers();

		// Q1: toggle Git + enter Other "Custom Tool"
		handlers!.handleInput(' ');
		typeOther('Custom Tool', 2);
		// Now on Q2 (single-select, cursor on Go)

		// Q2: confirm Go
		handlers!.handleInput('enter');
		// Now on Submit tab (currentTab=2)

		// Navigate back: Submit → Q2 → Q1
		handlers!.handleInput('left');
		handlers!.handleInput('left');
		// Now on Q1, cursor on Git (display 0)

		// Re-confirm Q1 by pressing Enter on Git
		handlers!.handleInput('enter');
		// Now on Q2 (advanceAfterAnswer goes to next question, not Submit)
		// Re-confirm Q2: Enter on Go advances to Submit
		handlers!.handleInput('enter');
		// Now on Submit tab

		// Submit
		handlers!.handleInput('enter');

		const result = (await resultPromise) as {
			details: {
				answers: Array<MultiAnswer | { value: string; label: string; wasCustom: boolean }>;
			};
		};
		expect(result.details.cancelled).toBe(false);

		const q1Answer = result.details.answers[0] as MultiAnswer;
		const items = q1Answer.items;
		expect(items).toHaveLength(2);
		expect(items.some((i) => i.value === 'git')).toBe(true);
		const otherItem = items.find((i) => i.value === '(other)');
		expect(otherItem).toBeDefined();
		expect(otherItem?.label).toBe('Custom Tool');
	});

	it('replaces Other when user re-enters Other with a different label', async () => {
		// Multi-question form so we can navigate back to Q1
		const resultPromise = setupExecute([multiQuestion, singleQuestion]);
		await waitForHandlers();

		handlers!.handleInput(' '); // toggle Git
		typeOther('First Tool', 2);
		// Q2 → Submit via Enter
		handlers!.handleInput('enter');
		// Navigate back to Q1
		handlers!.handleInput('left');
		handlers!.handleInput('left');
		// Re-enter Other
		typeOther('Second Tool', 2);
		// Q2 → Submit via Enter
		handlers!.handleInput('enter');
		// Submit
		handlers!.handleInput('enter');

		const result = (await resultPromise) as { details: { answers: MultiAnswer[] } };
		const items = result.details.answers[0].items;
		const otherItem = items.find((i) => i.value === '(other)');
		expect(otherItem?.label).toBe('Second Tool');
	});

	it('renders Other as selected (☑) after re-entry in a multi-question form', async () => {
		const resultPromise = setupExecute([multiQuestion, singleQuestion]);
		await waitForHandlers();

		handlers!.handleInput(' '); // toggle Git
		typeOther('Custom Tool', 2);
		handlers!.handleInput('enter'); // Q2 → Submit
		handlers!.handleInput('left');
		handlers!.handleInput('left');
		// On Q1 again — render and inspect

		const lines = handlers!.render(80);
		const otherLine = lines.find((l) => l.includes('Other'));
		expect(otherLine).toBeDefined();
		expect(otherLine).toContain('☑');

		// Clean up
		handlers!.handleInput('escape');
		await resultPromise;
	});

	it('deselects Other via Space after it was previously entered', async () => {
		const resultPromise = setupExecute([multiQuestion, singleQuestion]);
		await waitForHandlers();

		// Q1: toggle Git + enter Other "Custom Tool"
		handlers!.handleInput(' ');
		typeOther('Custom Tool', 2);
		// Q2 → Submit via Enter
		handlers!.handleInput('enter');
		// Navigate back to Q1
		handlers!.handleInput('left');
		handlers!.handleInput('left');
		// On Q1, Other is selected with label "Custom Tool"
		// Move cursor to Other (Git=0, Docker=1, Other=2)
		handlers!.handleInput('down');
		handlers!.handleInput('down');
		// Press Space to deselect Other
		handlers!.handleInput(' ');
		// Move cursor back to Git to re-confirm
		handlers!.handleInput('up');
		handlers!.handleInput('up');
		handlers!.handleInput('enter'); // re-confirm Q1
		handlers!.handleInput('enter'); // re-confirm Q2
		handlers!.handleInput('enter'); // submit

		const result = (await resultPromise) as { details: { answers: MultiAnswer[] } };
		const items = result.details.answers[0].items;
		// Git should still be selected, Other should be gone
		expect(items.some((i) => i.value === 'git')).toBe(true);
		expect(items.some((i) => i.value === '(other)')).toBe(false);
	});

	it('does not create a phantom Other selection when Space is pressed on Other with no prior label', async () => {
		// Regression: Space on Other with no label previously added OTHER_INDEX
		// to selectedOptions without setting otherLabels, leaving Other visually
		// checked but missing from the saved answer.
		// Fix: Space on Other with no label should open input mode (same as Enter).
		const resultPromise = setupExecute([multiQuestion]);
		await waitForHandlers();

		// Move cursor to Other (Git=0, Docker=1, Other=2)
		handlers!.handleInput('down');
		handlers!.handleInput('down');
		// Press Space on Other with no prior label
		handlers!.handleInput(' ');
		// Type a label and submit via Enter (confirms input mode is active)
		for (const ch of 'Custom') handlers!.handleInput(ch);
		handlers!.handleInput('enter');

		const result = (await resultPromise) as { details: { answers: MultiAnswer[] } };
		const items = result.details.answers[0].items;
		// Only the custom Other should be in the answer
		expect(items).toHaveLength(1);
		const otherItem = items.find((i) => i.value === '(other)');
		expect(otherItem).toBeDefined();
		expect(otherItem?.label).toBe('Custom');
	});
});
