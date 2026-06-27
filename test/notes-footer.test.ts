/**
 * Tests for the "Selected: …" footer in the question view
 *
 * Regression: notes attached to multi-select items were only visible on the
 * Submit tab, not while the user was still on the question view. The footer
 * now mirrors the Submit tab format.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@mariozechner/pi-coding-agent', () => ({
	ExtensionAPI: class {},
}));

const editorState = vi.hoisted(() => ({ getText: '' }));

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
}

describe('Multi-Select: Selected footer shows notes', () => {
	let handlers: Handlers | null;

	beforeEach(() => {
		editorState.getText = '';
		const mockPi = createMockPi();
		questionnaire(mockPi);
		const tool = mockPi.registerTool.mock.calls[0][0];
		handlers = null;

		const mockCustom = vi.fn().mockImplementation((cb: (...args: unknown[]) => void) => {
			handlers = cb(createMockTui(), createMockTheme(), {}, () => {}) as Handlers;
			return new Promise(() => {}); // never resolves
		});

		tool.execute(
			'call-id',
			{
				questions: [
					{
						questionTopic: 'Tools',
						prompt: 'Select tools',
						type: 'multi',
						options: [
							{ value: 'git', label: 'Git' },
							{ value: 'docker', label: 'Docker' },
						],
					},
				],
			},
			new AbortController().signal,
			vi.fn(),
			{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: vi.fn() },
		);
	});

	async function waitForHandlers() {
		for (let i = 0; i < 50 && !handlers; i++) {
			await new Promise((r) => setTimeout(r, 5));
		}
		if (!handlers) throw new Error('handlers never set');
	}

	it('shows note inline in Selected footer when a selected item has a note', async () => {
		await waitForHandlers();
		// Toggle Git on
		handlers!.handleInput(' ');
		// Add a note to Git (cursor is on Git, it's selected, not Other)
		handlers!.handleInput('n');
		// Type the note
		handlers!.handleInput('f');
		handlers!.handleInput('o');
		handlers!.handleInput('r');
		// Submit the note
		handlers!.handleInput('enter');
		// We're back on the question view; render and check the footer
		const lines = handlers!.render(120);
		const selectedLine = lines.find((l) => l.includes('Selected:'));
		expect(selectedLine).toBeDefined();
		expect(selectedLine).toContain('Git');
		expect(selectedLine).toContain('for');
	});
});
