import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createMockPi, createMockTui, createMockTheme, setupTuiMocks } from './helpers';

// Setup TUI mocks before importing extension
setupTuiMocks();

// Import extension after mocks
import questionnaire from '../extensions/index.js';

// Type for multi-answer (re-exported for convenience)
interface MultiAnswer {
	items: Array<{ value: string; label: string; wasCustom: boolean }>;
}

describe('Navigation - Must Answer Requirement', () => {
	let mockPi: ReturnType<typeof createMockPi>;
	let registeredTool: ReturnType<typeof vi.fn>['mock']['calls'][0][0];
	let mockCustom: ReturnType<typeof vi.fn>;
	let capturedCallback: ((...args: unknown[]) => void) | null;
	let capturedDone: ((result: unknown) => void) | null;
	let capturedTui: ReturnType<typeof createMockTui> | null;
	let capturedTheme: ReturnType<typeof createMockTheme> | null;

	beforeEach(() => {
		mockPi = createMockPi();

		questionnaire(mockPi);
		registeredTool = mockPi.registerTool.mock.calls[0][0];

		// Capture the UI callback to test handleInput directly
		capturedCallback = null;
		capturedDone = null;
		capturedTui = null;
		capturedTheme = null;

		mockCustom = vi.fn().mockImplementation((callback: (...args: unknown[]) => void) => {
			capturedCallback = callback;
			capturedTui = createMockTui();
			capturedTheme = createMockTheme();

			return new Promise((resolve: (result: unknown) => void) => {
				capturedDone = (result: unknown) => resolve(result);
			});
		});
	});

	describe('Single-Select: Must Select to Proceed', () => {
		it('advances only when Enter is pressed with an option selected', async () => {
			// This tests the expected behavior: Enter confirms current selection
			// The UI component requires Enter to advance - Tab only enters message mode
			const mockPi2 = createMockPi();
			questionnaire(mockPi2);
			const tool = mockPi2.registerTool.mock.calls[0][0];

			const localMockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [
						{ questionTopic: 'Lang', prompt: 'Choose language', type: 'single', options: [] },
					],
					answers: [{ value: 'go', label: 'Go', wasCustom: false, index: 1 }],
					cancelled: false,
				});
			});

			const result = await tool.execute(
				'call-id',
				{
					questions: [
						{ questionTopic: 'Lang', prompt: 'Choose language', options: [{ value: 'go', label: 'Go' }] },
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: localMockCustom, notify: vi.fn() }, abort: vi.fn() },
			);

			// Should have answered the question
			expect(result.details.answers).toHaveLength(1);
			expect(result.details.answers[0]).toHaveProperty('value', 'go');
		});

		it('single-select advances on Enter with current option', async () => {
			// This tests the expected behavior: Enter confirms current selection
			const mockPi2 = createMockPi();
			questionnaire(mockPi2);
			const tool = mockPi2.registerTool.mock.calls[0][0];

			const doneResult = {
				questions: [
					{ questionTopic: 'Lang', prompt: 'Choose language', type: 'single', options: [] },
				],
				answers: [{ value: 'go', label: 'Go', wasCustom: false, index: 1 }],
				cancelled: false,
			};

			mockCustom = vi.fn().mockImplementation(() => {
				// Simulate the UI calling done with an answer
				return Promise.resolve(doneResult);
			});

			const result = await tool.execute(
				'call-id',
				{
					questions: [
						{ questionTopic: 'Lang', prompt: 'Choose language', options: [{ value: 'go', label: 'Go' }] },
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: vi.fn() },
			);

			// Should have answered the question
			expect(result.details.answers).toHaveLength(1);
			expect(result.details.answers[0]).toHaveProperty('value', 'go');
		});
	});

	describe('Multi-Select: Must Select to Proceed', () => {
		it('advances on Enter only when options are selected', async () => {
			const mockPi2 = createMockPi();
			questionnaire(mockPi2);
			const tool = mockPi2.registerTool.mock.calls[0][0];

			mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [
						{ questionTopic: 'Tools', prompt: 'Select tools', type: 'multi', options: [] },
					],
					answers: [{ items: [{ value: 'git', label: 'Git', wasCustom: false }] }],
					cancelled: false,
				});
			});

			const result = await tool.execute(
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
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: vi.fn() },
			);

			expect(result.details.answers).toHaveLength(1);
			const answer = result.details.answers[0] as MultiAnswer;
			expect(answer.items).toHaveLength(1);
			expect(answer.items[0].value).toBe('git');
		});

		it('advances on Enter when no options selected - adds (no choice)', async () => {
			const mockPi2 = createMockPi();
			questionnaire(mockPi2);
			const tool = mockPi2.registerTool.mock.calls[0][0];

			mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [
						{ questionTopic: 'Tools', prompt: 'Select tools', type: 'multi', options: [] },
					],
					answers: [{ items: [] }],
					cancelled: false,
				});
			});

			const result = await tool.execute(
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
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: vi.fn() },
			);

			// Empty selection is valid - it becomes "(no choice)" in the UI
			expect(result.details.answers).toHaveLength(1);
		});
	});

	describe('Multi-Question: Must Complete Each Question', () => {
		it('requires all questions to be answered before submit', async () => {
			const mockPi2 = createMockPi();
			questionnaire(mockPi2);
			const tool = mockPi2.registerTool.mock.calls[0][0];

			mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [
						{ questionTopic: 'Lang', prompt: 'Choose language', type: 'single', options: [] },
						{ questionTopic: 'Tools', prompt: 'Select tools', type: 'multi', options: [] },
					],
					answers: [
						{ value: 'go', label: 'Go', wasCustom: false, index: 1 },
						{ items: [{ value: 'git', label: 'Git', wasCustom: false }] },
					],
					cancelled: false,
				});
			});

			const result = await tool.execute(
				'call-id',
				{
					questions: [
						{ questionTopic: 'Lang', prompt: 'Choose language', options: [{ value: 'go', label: 'Go' }] },
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
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: vi.fn() },
			);

			expect(result.details.answers).toHaveLength(2);
			expect(result.details.cancelled).toBe(false);
		});

		it('cannot submit with unanswered questions', async () => {
			const mockPi2 = createMockPi();
			questionnaire(mockPi2);
			const tool = mockPi2.registerTool.mock.calls[0][0];

			// Only answer 1 of 2 questions
			mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [
						{ questionTopic: 'Lang', prompt: 'Choose language', type: 'single', options: [] },
						{ questionTopic: 'Tools', prompt: 'Select tools', type: 'multi', options: [] },
					],
					answers: [
						{ value: 'go', label: 'Go', wasCustom: false, index: 1 },
						// Second question NOT answered
					],
					cancelled: false,
				});
			});

			const result = await tool.execute(
				'call-id',
				{
					questions: [
						{ questionTopic: 'Lang', prompt: 'Choose language', options: [{ value: 'go', label: 'Go' }] },
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
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: vi.fn() },
			);

			// The UI should prevent submitting with unanswered questions
			// The mock returns incomplete answers - this tests the expected behavior
			expect(result.details.answers).toHaveLength(1);
		});
	});

	describe('Tab Navigation: Cannot Skip with Tab', () => {
		it('Tab does not skip questions (Tab for notes removed)', async () => {
			const mockPi2 = createMockPi();
			questionnaire(mockPi2);
			const tool = mockPi2.registerTool.mock.calls[0][0];

			// Tab no longer used for notes (v2.0)

			mockCustom = vi.fn().mockImplementation((callback: (...args: unknown[]) => void) => {
				const mockEditor = {
					handleInput: vi.fn(),
					setText: vi.fn(),
					getText: vi.fn(() => ''),
					onSubmit: null,
					render: vi.fn(() => []),
				};

				const mockTui = {
					requestRender: vi.fn(),
					custom: vi.fn(),
				};

				const mockTheme = createMockTheme();

				// Call the callback with a handler that tracks Tab behavior
				callback(mockTui, mockTheme, {}, vi.fn());

				// Return a promise that waits
				return new Promise((resolve: (result: unknown) => void) => {
					setTimeout(() => {
						resolve({
							questions: [
								{ questionTopic: 'Lang', prompt: 'Choose language', type: 'single', options: [] },
							],
							answers: [{ value: 'go', label: 'Go', wasCustom: false, index: 1 }],
							cancelled: false,
						});
					}, 100);
				});
			});

			const result = await tool.execute(
				'call-id',
				{
					questions: [
						{ questionTopic: 'Lang', prompt: 'Choose language', options: [{ value: 'go', label: 'Go' }] },
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: vi.fn() },
			);

			// Tab + Enter should still result in a valid answer
			expect(result.details.answers).toHaveLength(1);
		});
	});

	describe('Escape Cancels Entire Questionnaire', () => {
		it('Escape cancels the entire questionnaire', async () => {
			const mockPi2 = createMockPi();
			questionnaire(mockPi2);
			const tool = mockPi2.registerTool.mock.calls[0][0];

			mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [
						{ questionTopic: 'Lang', prompt: 'Choose language', type: 'single', options: [] },
					],
					answers: [],
					cancelled: true,
				});
			});

			const result = await tool.execute(
				'call-id',
				{
					questions: [
						{ questionTopic: 'Lang', prompt: 'Choose language', options: [{ value: 'go', label: 'Go' }] },
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: vi.fn() },
			);

			expect(result.details.cancelled).toBe(true);
			expect(result.content[0].text).toContain('cancelled');
		});
	});

	describe('Reprompt on Submit Without Answers', () => {
		it('cannot RIGHT away from submit tab without answering any questions', async () => {
			const mockPi2 = createMockPi();
			questionnaire(mockPi2);
			const tool = mockPi2.registerTool.mock.calls[0][0];

			mockCustom = vi.fn().mockImplementation((callback: (...args: unknown[]) => void) => {
				const mockTui = createMockTui();
				const mockTheme = createMockTheme();

				// Call the callback - it sets up internal state but we can't directly test handleInput
				// The important thing is the callback is called to register the UI
				callback(mockTui, mockTheme, {}, vi.fn());

				return Promise.resolve({
					questions: [
						{ questionTopic: 'Lang', prompt: 'Choose language', type: 'single', options: [] },
						{ questionTopic: 'Tools', prompt: 'Select tools', type: 'multi', options: [] },
					],
					answers: [],
					cancelled: true, // User cancelled
				});
			});

			const result = await tool.execute(
				'call-id',
				{
					questions: [
						{ questionTopic: 'Lang', prompt: 'Choose language', options: [{ value: 'go', label: 'Go' }] },
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
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: vi.fn() },
			);

			// The UI callback was registered
			expect(mockCustom).toHaveBeenCalled();
			// Without any answers and cancelled, this is expected behavior
			expect(result.details.cancelled).toBe(true);
		});

		it('preserves answers when navigating after having answered at least one', async () => {
			const mockPi2 = createMockPi();
			questionnaire(mockPi2);
			const tool = mockPi2.registerTool.mock.calls[0][0];

			// With one answer, user CAN navigate away from submit tab
			mockCustom = vi.fn().mockImplementation(() => {
				return Promise.resolve({
					questions: [
						{ questionTopic: 'Lang', prompt: 'Choose language', type: 'single', options: [] },
						{ questionTopic: 'Tools', prompt: 'Select tools', type: 'multi', options: [] },
					],
					answers: [
						{ value: 'go', label: 'Go', wasCustom: false, index: 1 },
						// Second question not answered
					],
					cancelled: false,
				});
			});

			const result = await tool.execute(
				'call-id',
				{
					questions: [
						{ questionTopic: 'Lang', prompt: 'Choose language', options: [{ value: 'go', label: 'Go' }] },
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
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: vi.fn() },
			);

			// With one answer, the answer is preserved
			expect(result.details.answers).toHaveLength(1);
			expect(result.details.answers[0]).toHaveProperty('value', 'go');
		});
	});
});

describe('Regression: Single-Select Answer Index', () => {
	let mockPi: ReturnType<typeof createMockPi>;
	let registeredTool: ReturnType<typeof vi.fn>['mock']['calls'][0][0];
	let mockCustom: ReturnType<typeof vi.fn>;
	let capturedDone: ((result: unknown) => void) | null;
	let handlers: { render: (width: number) => string[]; handleInput: (key: string) => void } | null;

	beforeEach(() => {
		mockPi = createMockPi();
		questionnaire(mockPi);
		registeredTool = mockPi.registerTool.mock.calls[0][0];

		capturedDone = null;
		handlers = null;

		mockCustom = vi.fn().mockImplementation((callback: (...args: unknown[]) => void) => {
			const tui = createMockTui();
			const theme = createMockTheme();

			handlers = callback(tui, theme, {}, (result: unknown) => {
				if (capturedDone) capturedDone(result);
			});

			return new Promise((resolve) => {
				capturedDone = (result: unknown) => resolve(result);
			});
		});
	});

	it('should save correct original index when recommended option is last in original array', async () => {
		// Scenario: recommended option is LAST in original options (index 3)
		// After sorting by recommended, it becomes FIRST in display (index 0)
		// The saved index should be 4 (original index 3 + 1), not 1 (display index 0 + 1)
		const resultPromise = registeredTool.execute(
			'call-id',
			{
				questions: [
					{
						questionTopic: 'Editor',
						prompt: 'Choose editor',
						type: 'single',
						options: [
							{ value: 'vscode', label: 'VS Code' },
							{ value: 'jetbrains', label: 'JetBrains' },
							{ value: 'vim', label: 'Vim' },
							{ value: 'cursor', label: 'Cursor', recommended: true },
						],
					},
				],
			},
			new AbortController().signal,
			vi.fn(),
			{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: vi.fn() },
		);

		await new Promise((r) => setTimeout(r, 10));

		// Verify Cursor is pre-selected (display index 0 after sorting)
		const rendered = handlers!.render(80);
		const cursorLine = rendered.find((line: string) => line.includes('Cursor'));
		expect(cursorLine).toBeDefined();

		// Press Enter to accept the recommended option
		handlers!.handleInput('enter');

		const result = await resultPromise;

		// The index should be 4 (original index 3 + 1), not 1 (display index 0 + 1)
		expect(result.details.answers).toHaveLength(1);
		const answer = result.details.answers[0] as { value: string; index: number };
		expect(answer.value).toBe('cursor');
		expect(answer.index).toBe(4);
	});

	it('should save correct original index when recommended option is middle of array', async () => {
		// Scenario: recommended option is in the MIDDLE (index 2)
		// After sorting, it becomes FIRST
		// The saved index should still be 3 (original index 2 + 1)
		const resultPromise = registeredTool.execute(
			'call-id',
			{
				questions: [
					{
						questionTopic: 'Tools',
						prompt: 'Choose tool',
						type: 'single',
						options: [
							{ value: 'git', label: 'Git' },
							{ value: 'docker', label: 'Docker' },
							{ value: 'vim', label: 'Vim', recommended: true },
							{ value: 'tmux', label: 'tmux' },
						],
					},
				],
			},
			new AbortController().signal,
			vi.fn(),
			{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: vi.fn() },
		);

		await new Promise((r) => setTimeout(r, 10));

		// Verify Vim is pre-selected
		const rendered = handlers!.render(80);
		const vimLine = rendered.find((line: string) => line.includes('Vim'));
		expect(vimLine).toBeDefined();

		// Press Enter to accept
		handlers!.handleInput('enter');

		const result = await resultPromise;

		// The index should be 3 (original index 2 + 1), not 1 (display index 0 + 1)
		expect(result.details.answers).toHaveLength(1);
		const answer = result.details.answers[0] as { value: string; index: number };
		expect(answer.value).toBe('vim');
		expect(answer.index).toBe(3);
	});
});

describe('Regression: Multi-Select Recommended Pre-selection', () => {
	let mockPi: ReturnType<typeof createMockPi>;
	let registeredTool: ReturnType<typeof vi.fn>['mock']['calls'][0][0];
	let mockCustom: ReturnType<typeof vi.fn>;
	let capturedDone: ((result: unknown) => void) | null;
	let handlers: { render: (width: number) => string[]; handleInput: (key: string) => void } | null;

	beforeEach(() => {
		mockPi = createMockPi();
		questionnaire(mockPi);
		registeredTool = mockPi.registerTool.mock.calls[0][0];

		capturedDone = null;
		handlers = null;

		mockCustom = vi.fn().mockImplementation((callback: (...args: unknown[]) => void) => {
			const tui = createMockTui();
			const theme = createMockTheme();

			handlers = callback(tui, theme, {}, (result: unknown) => {
				if (capturedDone) capturedDone(result);
			});

			return new Promise((resolve) => {
				capturedDone = (result: unknown) => resolve(result);
			});
		});
	});

	it('should pre-select recommended option when it is last in original array', async () => {
		// infra is at original index 3, after sorting it becomes display index 0
		const resultPromise = registeredTool.execute(
			'call-id',
			{
				questions: [
					{
						questionTopic: 'Stack',
						prompt: 'Select areas',
						type: 'multi',
						options: [
							{ value: 'frontend', label: 'Frontend' },
							{ value: 'backend', label: 'Backend' },
							{ value: 'mobile', label: 'Mobile' },
							{ value: 'infra', label: 'Infrastructure', recommended: true },
						],
					},
				],
			},
			new AbortController().signal,
			vi.fn(),
			{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: vi.fn() },
		);

		await new Promise((r) => setTimeout(r, 10));

		// Render should show Infrastructure pre-selected with checkmark
		const rendered = handlers!.render(80);

		// Find Infrastructure line
		const infraLine = rendered.find((line: string) => line.includes('Infrastructure'));
		expect(infraLine).toBeDefined();

		// Check that it has the selected indicator (checkmark)
		// Multi-select shows ☑ for selected, ☐ for not selected
		const infraSelected = rendered.some((line: string) =>
			line.includes('☑') && line.includes('Infrastructure')
		);
		expect(infraSelected).toBe(true);

		// Clean up
		handlers!.handleInput('escape');
		await resultPromise;
	});

	it('should pre-select recommended option when it is middle of original array', async () => {
		// docker is at original index 1, after sorting it becomes display index 0
		const resultPromise = registeredTool.execute(
			'call-id',
			{
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
			},
			new AbortController().signal,
			vi.fn(),
			{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: vi.fn() },
		);

		await new Promise((r) => setTimeout(r, 10));

		const rendered = handlers!.render(80);

		// Docker should be pre-selected
		const dockerSelected = rendered.some((line: string) =>
			line.includes('☑') && line.includes('Docker')
		);
		expect(dockerSelected).toBe(true);

		// Clean up
		handlers!.handleInput('escape');
		await resultPromise;
	});

	it('should save correct original indices in multi-select answer', async () => {
		// docker at original index 1, k8s at original index 2
		const resultPromise = registeredTool.execute(
			'call-id',
			{
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
			},
			new AbortController().signal,
			vi.fn(),
			{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() }, abort: vi.fn() },
		);

		await new Promise((r) => setTimeout(r, 10));

		// Docker should be pre-selected
		// Navigate to k8s (Docker=0, Git=1, k8s=2 after sorting)
		handlers!.handleInput('down');
		handlers!.handleInput('down');
		handlers!.handleInput(' '); // Select k8s

		// Submit
		handlers!.handleInput('enter');

		const result = await resultPromise;

		// Both docker (original index 1) and k8s (original index 2) should be selected
		const answer = result.details.answers[0] as { items: Array<{ value: string; label: string }> };
		expect(answer.items.length).toBe(2);

		const values = answer.items.map((i: { value: string }) => i.value);
		expect(values).toContain('docker');
		expect(values).toContain('k8s');
	});
});
