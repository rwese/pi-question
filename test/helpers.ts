/**
 * Shared test helpers for pi-question tests
 * Contains TUI mocks, mock Pi instances, and common test utilities
 */
// fallow-ignore-file

import { vi } from 'vitest';

// ============================================================================
// TUI Mock Factory
// ============================================================================

export interface MockTui {
	requestRender: ReturnType<typeof vi.fn>;
}

export interface MockTheme {
	fg: ReturnType<typeof vi.fn>;
	bg: ReturnType<typeof vi.fn>;
	bold: ReturnType<typeof vi.fn>;
}

export interface MockEditor {
	handleInput: ReturnType<typeof vi.fn>;
	setText: ReturnType<typeof vi.fn>;
	getText: ReturnType<typeof vi.fn>;
	onSubmit: ((value: string) => void) | null;
	render: ReturnType<typeof vi.fn>;
}

export function createMockEditor(): MockEditor {
	return {
		handleInput: vi.fn(),
		setText: vi.fn(),
		getText: vi.fn(() => ''),
		onSubmit: null,
		render: vi.fn(() => []),
	};
}

export function createMockTui(): MockTui {
	return {
		requestRender: vi.fn(),
	};
}

export function createMockTheme(): MockTheme {
	return {
		fg: vi.fn((_color: string, text: string) => text),
		bg: vi.fn((_color: string, text: string) => text),
		bold: vi.fn((text: string) => text),
	};
}

export type CustomUICallback = (
	tui: MockTui,
	theme: MockTheme,
	_kb: Record<string, unknown>,
	done: (result: unknown) => void,
) => void;

export function createMockCustom(): {
	mockFn: ReturnType<typeof vi.fn>;
	tui: MockTui;
	theme: MockTheme;
	callback: CustomUICallback | null;
} {
	const tui = createMockTui();
	const theme = createMockTheme();
	let callback: CustomUICallback | null = null;

	const mockFn = vi.fn().mockImplementation((cb: CustomUICallback) => {
		callback = cb;
		// Return a pending promise that will be resolved by the test
		return new Promise((resolve) => {
			// Store resolve function for test to call
			(mockFn as ReturnType<typeof vi.fn> & { _resolve?: (v: unknown) => void })._resolve =
				resolve;
		});
	});

	return { mockFn, tui, theme, callback: callback as unknown as CustomUICallback };
}

// ============================================================================
// Mock Pi Instance
// ============================================================================

export interface MockPiInstance {
	registerTool: ReturnType<typeof vi.fn>;
	sendMessage: ReturnType<typeof vi.fn>;
	registerCommand: ReturnType<typeof vi.fn>;
	registerFlag: ReturnType<typeof vi.fn>;
	getFlag: ReturnType<typeof vi.fn>;
	getActiveTools: ReturnType<typeof vi.fn>;
	setActiveTools: ReturnType<typeof vi.fn>;
}

// Flag storage for tests
const flagValues = new Map<string, unknown>();

// Default active tools
const defaultActiveTools = ['read', 'bash', 'write', 'edit', 'grep', 'find', 'ls', 'question'];

export function createMockPi(): MockPiInstance {
	return {
		registerTool: vi.fn(),
		sendMessage: vi.fn(),
		registerCommand: vi.fn(),
		registerFlag: vi.fn(),
		getFlag: vi.fn((name: string) => flagValues.get(name) ?? false),
		getActiveTools: vi.fn(() => [...defaultActiveTools]),
		setActiveTools: vi.fn(),
	};
}

export function resetMockFlags(): void {
	flagValues.clear();
}

export function setMockFlag(name: string, value: unknown): void {
	flagValues.set(name, value);
}

// ============================================================================
// TUI Mock Setup (for vi.mock)
// ============================================================================

export function setupTuiMocks() {
	// Mock pi-coding-agent
	vi.mock('@mariozechner/pi-coding-agent', () => ({
		Editor: vi.fn(),
		Key: {},
		matchesKey: vi.fn(),
		Text: vi.fn(),
		truncateToWidth: vi.fn((s: string) => s),
		wrapTextWithAnsi: vi.fn((text: string, width: number): string[] => [text]),
		visibleWidth: vi.fn((text: string): number => text.length),
	}));

	// Mock pi-tui
	vi.mock('@mariozechner/pi-tui', () => ({
		Editor: vi.fn().mockImplementation(() => createMockEditor()),
		Key: {
			up: 'up',
			down: 'down',
			enter: 'enter',
			escape: 'escape',
			tab: 'tab',
			left: 'left',
			right: 'right',
			shift: (key: string) => `shift+${key}`,
		},
		matchesKey: vi.fn(),
		parseKey: vi.fn((data: string) => data),
		Text: vi.fn().mockImplementation((text: string) => ({ text, line: 0, col: 0 })),
		truncateToWidth: vi.fn((s: string) => s),
		wrapTextWithAnsi: vi.fn((text: string, width: number): string[] => [text]),
		visibleWidth: vi.fn((text: string): number => text.length),
	}));
}

// ============================================================================
// Common Test Fixtures
// ============================================================================

export const DEFAULT_WIDTH = 80;

export function createDefaultQuestions() {
	return [
		{
			questionTopic: 'Lang',
			prompt: 'Choose language',
			type: 'single' as const,
			options: [{ value: 'go', label: 'Go' }],
		},
		{
			questionTopic: 'Tools',
			prompt: 'Select tools',
			type: 'multi' as const,
			options: [{ value: 'git', label: 'Git' }],
		},
	];
}

export function createToolExecuteParams(
	questions: ReturnType<typeof createDefaultQuestions>,
): Record<string, unknown> {
	return {
		questions,
	};
}

// ============================================================================
// Word Wrap Test Helpers
// ============================================================================

/**
 * Word-wrap mock implementation
 */
function wordWrapImplementation(text: string, width: number): string[] {
	const words = text.split(' ');
	const lines: string[] = [];
	let currentLine = '';

	for (const word of words) {
		const testLine = currentLine ? `${currentLine} ${word}` : word;
		if (testLine.length <= width) {
			currentLine = testLine;
		} else {
			if (currentLine) {
				lines.push(currentLine);
			}
			currentLine = word;
		}
	}
	if (currentLine) {
		lines.push(currentLine);
	}
	return lines;
}

/**
 * Visible width mock implementation
 */
function visibleWidthImplementation(text: string): number {
	// Strip ANSI codes for simplicity in tests
	return text.replace(/\x1b\[[0-9;]*m/g, '').length;
}

export function createMockWrapTextWithAnsi() {
	return vi.fn(wordWrapImplementation);
}

export function createMockVisibleWidth() {
	return vi.fn(visibleWidthImplementation);
}

/**
 * Setup mocks with specialized word-wrap implementations.
 * Use this for tests that need to verify word-wrap behavior.
 * Note: Uses vi.hoisted() to define mocks that are hoisted together with vi.mock
 */
export function setupWordWrapMocks() {
	// Use vi.hoisted to define mocks at the same hoisting level as vi.mock
	const { sharedEditor, sharedWrapText, sharedVisibleWidth } = vi.hoisted(() => ({
		sharedEditor: createMockEditor(),
		sharedWrapText: vi.fn(wordWrapImplementation),
		sharedVisibleWidth: vi.fn(visibleWidthImplementation),
	}));

	vi.mock('@mariozechner/pi-coding-agent', () => ({
		Editor: vi.fn(() => sharedEditor),
		Key: {
			up: 'up',
			down: 'down',
			enter: 'enter',
			escape: 'escape',
			tab: 'tab',
			left: 'left',
			right: 'right',
			space: ' ',
			shift: (key: string) => `shift+${key}`,
		},
		matchesKey: vi.fn((data: string, pattern: string) => data === pattern),
		parseKey: vi.fn((data: string) => data),
		Text: vi.fn().mockImplementation((text: string) => ({ text, line: 0, col: 0 })),
		truncateToWidth: vi.fn((s: string) => s),
		wrapTextWithAnsi: sharedWrapText,
		visibleWidth: sharedVisibleWidth,
	}));

	vi.mock('@mariozechner/pi-tui', () => ({
		Editor: vi.fn(() => sharedEditor),
		Key: {
			up: 'up',
			down: 'down',
			enter: 'enter',
			escape: 'escape',
			tab: 'tab',
			left: 'left',
			right: 'right',
			space: ' ',
			shift: (key: string) => `shift+${key}`,
		},
		matchesKey: vi.fn((data: string, pattern: string) => data === pattern),
		parseKey: vi.fn((data: string) => data),
		Text: vi.fn().mockImplementation((text: string) => ({ text, line: 0, col: 0 })),
		truncateToWidth: vi.fn((s: string) => s),
		wrapTextWithAnsi: sharedWrapText,
		visibleWidth: sharedVisibleWidth,
	}));
}
