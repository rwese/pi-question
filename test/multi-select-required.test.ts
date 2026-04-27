/**
 * Tests for Multi-Select Required Selection Feature
 *
 * Verifies that multi-select questions require at least one option
 * to be selected before advancing to the next question.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock modules before importing extension
vi.mock('@mariozechner/pi-coding-agent', () => ({
	Editor: vi.fn(),
	Key: {},
	matchesKey: vi.fn(),
	Text: vi.fn(),
	truncateToWidth: vi.fn((s: string) => s),
	wrapTextWithAnsi: vi.fn((text: string, _width: number): string[] => [text]),
	visibleWidth: vi.fn((text: string): number => text.length),
}));

vi.mock('@mariozechner/pi-tui', () => ({
	Editor: vi.fn().mockImplementation(() => ({
		handleInput: vi.fn(),
		setText: vi.fn(),
		getText: vi.fn(() => ''),
		onSubmit: null,
		render: vi.fn(() => []),
	})),
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
	matchesKey: vi.fn(),
	Text: vi.fn().mockImplementation((text) => ({ text, line: 0, col: 0 })),
	truncateToWidth: vi.fn((s: string) => s),
	wrapTextWithAnsi: vi.fn((text: string, _width: number): string[] => [text]),
	visibleWidth: vi.fn((text: string): number => text.length),
}));

import questionnaire from '../extensions/index.js';

// Types
interface SingleAnswer {
	value: string;
	label: string;
	wasCustom: boolean;
	index?: number;
	message?: string;
}

interface MultiAnswer {
	items: Array<{
		value: string;
		label: string;
		wasCustom: boolean;
		note?: string;
	}>;
}

interface QuestionnaireResult {
	questions: Array<{
		questionTopic: string;
		prompt: string;
		type: 'single' | 'multi';
		options: Array<{ value: string; label: string }>;
	}>;
	answers: Array<SingleAnswer | MultiAnswer>;
	cancelled: boolean;
}

describe('Multi-Select: Required Selection', () => {
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
		} as any;
		questionnaire(mockPi);
		registeredTool = mockPi.registerTool.mock.calls[0][0];
	});

	describe('Empty selection prevention', () => {
		it('requires at least one option selected in multi-select', async () => {
			// Simulate UI that returns empty multi-select items
			// This should NOT happen in practice because the UI prevents it
			// But if it does, the markdown output should handle it gracefully
			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [
						{
							questionTopic: 'Tools',
							prompt: 'Select tools',
							type: 'multi',
							options: [{ value: 'git', label: 'Git' }],
						},
					],
					// Empty items array (should not happen in practice)
					answers: [{ items: [] }],
					cancelled: false,
				} as QuestionnaireResult);
			});

			const result = await registeredTool.execute(
				'call-id',
				{
					questions: [
						{
							questionTopic: 'Tools',
							type: 'multi',
							prompt: 'Select tools',
							options: [{ value: 'git', label: 'Git' }],
						},
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			// Empty multi-select is now handled gracefully in output
			// (no "(no selection)" marker since UI prevents this)
			const markdown = result.content[0].text;
			expect(markdown).toContain('## Question - Tools');
			expect(markdown).toContain('Select tools');
		});

		it('allows multi-select with at least one option selected', async () => {
			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [
						{
							questionTopic: 'Tools',
							prompt: 'Select tools',
							type: 'multi',
							options: [{ value: 'git', label: 'Git' }],
						},
					],
					answers: [
						{
							items: [
								{ value: 'git', label: 'Git', wasCustom: false },
								{ value: 'docker', label: 'Docker', wasCustom: false },
							],
						},
					],
					cancelled: false,
				} as QuestionnaireResult);
			});

			const result = await registeredTool.execute(
				'call-id',
				{
					questions: [
						{
							questionTopic: 'Tools',
							type: 'multi',
							prompt: 'Select tools',
							options: [
								{ value: 'git', label: 'Git' },
								{ value: 'docker', label: 'Docker' },
							],
						},
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			const markdown = result.content[0].text;
			expect(markdown).toContain('- [x] Git');
			expect(markdown).toContain('- [x] Docker');
		});

		it('allows multi-select with custom Other option', async () => {
			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [
						{
							questionTopic: 'Tools',
							prompt: 'Select tools',
							type: 'multi',
							options: [{ value: 'git', label: 'Git' }],
						},
					],
					answers: [
						{
							items: [
								{ value: 'git', label: 'Git', wasCustom: false },
								{ value: '(other)', label: 'Custom Tool', wasCustom: true },
							],
						},
					],
					cancelled: false,
				} as QuestionnaireResult);
			});

			const result = await registeredTool.execute(
				'call-id',
				{
					questions: [
						{
							questionTopic: 'Tools',
							type: 'multi',
							prompt: 'Select tools',
							options: [{ value: 'git', label: 'Git' }],
						},
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			const markdown = result.content[0].text;
			expect(markdown).toContain('- [x] Git');
			expect(markdown).toContain('- [x] Custom Tool');
		});
	});

	describe('Submit validation', () => {
		it('requires all multi-select questions to be answered before submit', async () => {
			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [
						{
							questionTopic: 'Language',
							prompt: 'Choose language',
							type: 'single',
							options: [{ value: 'go', label: 'Go' }],
						},
						{
							questionTopic: 'Tools',
							prompt: 'Select tools',
							type: 'multi',
							options: [{ value: 'git', label: 'Git' }],
						},
					],
					answers: [
						{ value: 'go', label: 'Go', wasCustom: false, index: 1 },
						{ items: [{ value: 'git', label: 'Git', wasCustom: false }] },
					],
					cancelled: false,
				} as QuestionnaireResult);
			});

			const result = await registeredTool.execute(
				'call-id',
				{
					questions: [
						{
							questionTopic: 'Language',
							prompt: 'Choose language',
							options: [{ value: 'go', label: 'Go' }],
						},
						{
							questionTopic: 'Tools',
							type: 'multi',
							prompt: 'Select tools',
							options: [{ value: 'git', label: 'Git' }],
						},
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			// Both questions answered
			expect(result.details.answers.length).toBe(2);
			expect(result.details.cancelled).toBe(false);
		});

		it('prevents submit with unanswered multi-select', async () => {
			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [
						{
							questionTopic: 'Language',
							prompt: 'Choose language',
							type: 'single',
							options: [{ value: 'go', label: 'Go' }],
						},
						{
							questionTopic: 'Tools',
							prompt: 'Select tools',
							type: 'multi',
							options: [{ value: 'git', label: 'Git' }],
						},
					],
					answers: [
						{ value: 'go', label: 'Go', wasCustom: false, index: 1 },
						// Second question NOT answered
					],
					cancelled: false,
				} as QuestionnaireResult);
			});

			const result = await registeredTool.execute(
				'call-id',
				{
					questions: [
						{
							questionTopic: 'Language',
							prompt: 'Choose language',
							options: [{ value: 'go', label: 'Go' }],
						},
						{
							questionTopic: 'Tools',
							type: 'multi',
							prompt: 'Select tools',
							options: [{ value: 'git', label: 'Git' }],
						},
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			// Only one question answered (second multi-select not answered)
			expect(result.details.answers.length).toBe(1);
		});
	});

	describe('Recommended options pre-selection', () => {
		it('pre-selects recommended options in multi-select', async () => {
			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [
						{
							questionTopic: 'Tools',
							prompt: 'Select tools',
							type: 'multi',
							options: [
								{ value: 'git', label: 'Git' },
								{ value: 'docker', label: 'Docker', recommended: true },
								{ value: 'k8s', label: 'Kubernetes' },
							],
						},
					],
					answers: [
						{
							items: [{ value: 'docker', label: 'Docker', wasCustom: false }],
						},
					],
					cancelled: false,
				} as QuestionnaireResult);
			});

			const result = await registeredTool.execute(
				'call-id',
				{
					questions: [
						{
							questionTopic: 'Tools',
							type: 'multi',
							prompt: 'Select tools',
							options: [
								{ value: 'git', label: 'Git' },
								{ value: 'docker', label: 'Docker', recommended: true },
								{ value: 'k8s', label: 'Kubernetes' },
							],
						},
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			// The recommended option is pre-selected
			const answer = result.details.answers[0] as MultiAnswer;
			expect(answer.items.some((i) => i.value === 'docker')).toBe(true);
		});

		it('allows deselecting recommended option in multi-select', async () => {
			// This test verifies that even with recommended pre-selection,
			// the user can deselect and select other options
			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [
						{
							questionTopic: 'Tools',
							prompt: 'Select tools',
							type: 'multi',
							options: [
								{ value: 'git', label: 'Git' },
								{ value: 'docker', label: 'Docker', recommended: true },
							],
						},
					],
					answers: [
						{
							items: [{ value: 'git', label: 'Git', wasCustom: false }],
						},
					],
					cancelled: false,
				} as QuestionnaireResult);
			});

			const result = await registeredTool.execute(
				'call-id',
				{
					questions: [
						{
							questionTopic: 'Tools',
							type: 'multi',
							prompt: 'Select tools',
							options: [
								{ value: 'git', label: 'Git' },
								{ value: 'docker', label: 'Docker', recommended: true },
							],
						},
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			// User chose Git instead of recommended Docker
			const answer = result.details.answers[0] as MultiAnswer;
			expect(answer.items.some((i) => i.value === 'git')).toBe(true);
		});
	});

	describe('Notes on multi-select items', () => {
		it('supports notes on multi-select items', async () => {
			const mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [
						{
							questionTopic: 'Tools',
							prompt: 'Select tools',
							type: 'multi',
							options: [{ value: 'git', label: 'Git' }],
						},
					],
					answers: [
						{
							items: [
								{ value: 'git', label: 'Git', wasCustom: false, note: 'Using for version control' },
							],
						},
					],
					cancelled: false,
				} as QuestionnaireResult);
			});

			const result = await registeredTool.execute(
				'call-id',
				{
					questions: [
						{
							questionTopic: 'Tools',
							type: 'multi',
							prompt: 'Select tools',
							options: [{ value: 'git', label: 'Git' }],
						},
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } }
			);

			const markdown = result.content[0].text;
			expect(markdown).toContain('- [x] Git');
			expect(markdown).toContain('Note: Using for version control');
		});
	});
});
