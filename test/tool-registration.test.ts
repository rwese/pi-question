import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createMockPi, setupTuiMocks } from './helpers';

// Setup TUI mocks before importing extension
setupTuiMocks();

// Import extension after mocks
import questionnaire from '../extensions/index.js';

describe('Tool Registration', () => {
	it('registers tool with correct name', () => {
		const mockPi = createMockPi();

		questionnaire(mockPi);

		expect(mockPi.registerTool).toHaveBeenCalledTimes(1);

		const registeredTool = mockPi.registerTool.mock.calls[0][0];

		expect(registeredTool).toHaveProperty('name', 'question');
	});

	it('registers tool with correct label', () => {
		const mockPi = createMockPi();

		questionnaire(mockPi);

		const registeredTool = mockPi.registerTool.mock.calls[0][0];

		expect(registeredTool).toHaveProperty('label', 'Question');
	});

	it('registers tool with non-empty description', () => {
		const mockPi = createMockPi();

		questionnaire(mockPi);

		const registeredTool = mockPi.registerTool.mock.calls[0][0];

		expect(registeredTool).toHaveProperty('description');
		expect(typeof registeredTool.description).toBe('string');
		expect(registeredTool.description.length).toBeGreaterThan(0);
	});

	it('registers tool with parameters schema', () => {
		const mockPi = createMockPi();

		questionnaire(mockPi);

		const registeredTool = mockPi.registerTool.mock.calls[0][0];

		expect(registeredTool).toHaveProperty('parameters');
		expect(registeredTool.parameters).toBeDefined();
	});

	it('registers tool with execute function', () => {
		const mockPi = createMockPi();

		questionnaire(mockPi);

		const registeredTool = mockPi.registerTool.mock.calls[0][0];

		expect(registeredTool).toHaveProperty('execute');
		expect(typeof registeredTool.execute).toBe('function');
	});

	it('registers tool with renderCall function', () => {
		const mockPi = createMockPi();

		questionnaire(mockPi);

		const registeredTool = mockPi.registerTool.mock.calls[0][0];

		expect(registeredTool).toHaveProperty('renderCall');
		expect(typeof registeredTool.renderCall).toBe('function');
	});

	it('registers tool with renderResult function', () => {
		const mockPi = createMockPi();

		questionnaire(mockPi);

		const registeredTool = mockPi.registerTool.mock.calls[0][0];

		expect(registeredTool).toHaveProperty('renderResult');
		expect(typeof registeredTool.renderResult).toBe('function');
	});

	it('execute returns error when no UI available', async () => {
		const mockPi = createMockPi();

		questionnaire(mockPi);

		const registeredTool = mockPi.registerTool.mock.calls[0][0];

		const result = await registeredTool.execute(
			'call-id',
			{ questions: [{ questionTopic: 'Test', prompt: 'Test?', options: [{ value: 'a', label: 'A' }] }] },
			new AbortController().signal,
			vi.fn(),
			{ hasUI: false },
		);

		expect(result.content[0]).toHaveProperty('type', 'text');
		expect(result.content[0].text).toContain('Error');
		expect(result.details).toHaveProperty('cancelled', true);
	});

	it('execute returns error when no questions provided', async () => {
		const mockPi = createMockPi();

		questionnaire(mockPi);

		const registeredTool = mockPi.registerTool.mock.calls[0][0];

		const result = await registeredTool.execute(
			'call-id',
			{ questions: [] },
			new AbortController().signal,
			vi.fn(),
			{ hasUI: true, ui: { custom: vi.fn() } },
		);

		expect(result.content[0]).toHaveProperty('type', 'text');
		expect(result.content[0].text).toContain('Error: No questions provided');
		expect(result.details).toHaveProperty('cancelled', true);
	});
});

describe('Disabled Extension', () => {
	// Use vi.resetModules to get a fresh module state for each test
	beforeEach(async () => {
		await vi.resetModules();
		// Re-setup mocks after reset
		setupTuiMocks();
	});

	it('execute returns markdown of questions when extension is disabled', async () => {
		// Re-import to get fresh module state
		const { default: questionnaire } = await import('../extensions/index.js');
		const mockPi = createMockPi();

		questionnaire(mockPi);

		const registeredTool = mockPi.registerTool.mock.calls[0][0];

		// Simulate disabled state by calling the disable command handler
		const disableCommand = mockPi.registerCommand.mock.calls.find(
			(call: unknown[]) => (call[0] as string) === 'pi-question:disabled',
		);
		expect(disableCommand).toBeDefined();

		// Call the disable handler
		const disableHandler = disableCommand[1].handler;
		await disableHandler([], { ui: { notify: vi.fn() } });

		// Now try to execute the tool
		const questions = [
			{
				questionTopic: 'Language',
				prompt: 'What is your preferred language?',
				type: 'single' as const,
				options: [
					{ value: 'go', label: 'Go' },
					{ value: 'rust', label: 'Rust' },
				],
			},
			{
				questionTopic: 'Tools',
				prompt: 'Select your preferred tools',
				type: 'multi' as const,
				options: [
					{ value: 'vim', label: 'Vim' },
					{ value: 'vscode', label: 'VS Code', recommended: true },
				],
			},
		];

		const result = await registeredTool.execute(
			'call-id',
			{ questions },
			new AbortController().signal,
			vi.fn(),
			{ hasUI: true },
		);

		// Should return markdown with the questions
		expect(result.content[0]).toHaveProperty('type', 'text');
		expect(result.content[0].text).toContain('Question extension is disabled');
		expect(result.content[0].text).toContain('Language');
		expect(result.content[0].text).toContain('What is your preferred language?');
		expect(result.content[0].text).toContain('Go');
		expect(result.content[0].text).toContain('Rust');
		expect(result.content[0].text).toContain('Tools');
		expect(result.content[0].text).toContain('Vim');
		expect(result.content[0].text).toContain('VS Code');
		expect(result.content[0].text).toContain('(Recommended)');
		expect(result.content[0].text).toContain('Multi-select');
		expect(result.content[0].text).toContain('Single-select');
		expect(result.details).toHaveProperty('cancelled', true);
		expect(result.details.questions).toHaveLength(2);
		expect(result.details.answers).toHaveLength(0);
	});

	it('includes option descriptions in disabled markdown', async () => {
		// Re-import to get fresh module state
		const { default: questionnaire } = await import('../extensions/index.js');
		const mockPi = createMockPi();

		questionnaire(mockPi);

		const registeredTool = mockPi.registerTool.mock.calls[0][0];

		// Call the disable handler to disable extension
		const disableCommand = mockPi.registerCommand.mock.calls.find(
			(call: unknown[]) => (call[0] as string) === 'pi-question:disabled',
		);
		if (disableCommand) {
			const disableHandler = disableCommand[1].handler;
			await disableHandler([], { ui: { notify: vi.fn() } });
		}

		const questions = [
			{
				questionTopic: 'Food',
				prompt: 'What is your favorite food?',
				type: 'single' as const,
				options: [
					{ value: 'pizza', label: 'Pizza', description: 'Classic Italian dish' },
					{ value: 'tacos', label: 'Tacos', description: 'Mexican delight' },
				],
			},
		];

		const result = await registeredTool.execute(
			'call-id',
			{ questions },
			new AbortController().signal,
			vi.fn(),
			{ hasUI: true },
		);

		expect(result.content[0].text).toContain('Pizza');
		expect(result.content[0].text).toContain('Classic Italian dish');
		expect(result.content[0].text).toContain('Tacos');
		expect(result.content[0].text).toContain('Mexican delight');
	});

	it('disabled check happens FIRST - even without hasUI or questions', async () => {
		// Re-import to get fresh module state
		const { default: questionnaire } = await import('../extensions/index.js');
		const mockPi = createMockPi();

		questionnaire(mockPi);

		const registeredTool = mockPi.registerTool.mock.calls[0][0];

		// Disable the extension
		const disableCommand = mockPi.registerCommand.mock.calls.find(
			(call: unknown[]) => (call[0] as string) === 'pi-question:disabled',
		);
		if (disableCommand) {
			const disableHandler = disableCommand[1].handler;
			await disableHandler([], { ui: { notify: vi.fn() } });
		}

		// Execute with NO questions and NO UI - disabled check should still return markdown
		const result = await registeredTool.execute(
			'call-id',
			{ questions: undefined }, // No questions
			new AbortController().signal,
			vi.fn(),
			{ hasUI: false }, // No UI
		);

		// Should return disabled markdown, NOT a validation error
		expect(result.content[0].text).toContain('Question extension is disabled');
		expect(result.details).toHaveProperty('cancelled', true);
	});

	it('disable does NOT call setActiveTools (tool stays registered for rejection)', async () => {
		// Re-import to get fresh module state
		const { default: questionnaire } = await import('../extensions/index.js');
		const mockPi = createMockPi();

		questionnaire(mockPi);

		// Disable the extension
		const disableCommand = mockPi.registerCommand.mock.calls.find(
			(call: unknown[]) => (call[0] as string) === 'pi-question:disabled',
		);
		if (disableCommand) {
			const disableHandler = disableCommand[1].handler;
			await disableHandler([], { ui: { notify: vi.fn() } });
		}

		// The tool must remain registered so calls are rejected with a proper
		// message instead of failing with a "tool not found" error. The
		// previous behaviour of removing it from the active tools list is
		// intentionally no longer supported.
		expect(mockPi.setActiveTools).not.toHaveBeenCalled();
	});

	it('tool remains registered and rejects with markdown after disable command', async () => {
		// Re-import to get fresh module state
		const { default: questionnaire } = await import('../extensions/index.js');
		const mockPi = createMockPi();

		questionnaire(mockPi);

		// Tool was registered exactly once
		expect(mockPi.registerTool).toHaveBeenCalledTimes(1);
		const registeredTool = mockPi.registerTool.mock.calls[0][0];
		expect(registeredTool).toHaveProperty('name', 'question');

		// Disable the extension
		const disableCommand = mockPi.registerCommand.mock.calls.find(
			(call: unknown[]) => (call[0] as string) === 'pi-question:disabled',
		);
		expect(disableCommand).toBeDefined();
		const disableHandler = disableCommand[1].handler;
		await disableHandler([], { ui: { notify: vi.fn() } });

		// Tool registration must not be replaced or removed
		expect(mockPi.registerTool).toHaveBeenCalledTimes(1);

		// Calling the tool after disable must return the rejection markdown
		const result = await registeredTool.execute(
			'call-id',
			{
				questions: [
					{
						questionTopic: 'Topic',
						prompt: 'Pick one',
						type: 'single',
						options: [{ value: 'a', label: 'A' }],
					},
				],
			},
			new AbortController().signal,
			vi.fn(),
			{ hasUI: true },
		);

		expect(result.content[0]).toHaveProperty('type', 'text');
		expect(result.content[0].text).toContain('Question extension is disabled');
		expect(result.details).toHaveProperty('cancelled', true);
	});

	it('enable command does NOT call setActiveTools to re-add the tool', async () => {
		// Re-import to get fresh module state
		const { default: questionnaire } = await import('../extensions/index.js');
		const mockPi = createMockPi();

		questionnaire(mockPi);

		// Disable then re-enable
		const disableCommand = mockPi.registerCommand.mock.calls.find(
			(call: unknown[]) => (call[0] as string) === 'pi-question:disabled',
		);
		const enableCommand = mockPi.registerCommand.mock.calls.find(
			(call: unknown[]) => (call[0] as string) === 'pi-question:enabled',
		);
		expect(disableCommand).toBeDefined();
		expect(enableCommand).toBeDefined();

		await disableCommand[1].handler([], { ui: { notify: vi.fn() } });
		await enableCommand[1].handler([], { ui: { notify: vi.fn() } });

		// The tool never leaves the active set - the enable command is a
		// no-op as far as the host's active tools are concerned.
		expect(mockPi.setActiveTools).not.toHaveBeenCalled();
	});

	it('--pi-question-disabled flag keeps the tool registered and rejects with markdown', async () => {
		// Re-import to get fresh module state
		const { default: questionnaire } = await import('../extensions/index.js');
		const mockPi = createMockPi();

		// Pretend the CLI flag was passed
		mockPi.getFlag.mockImplementation((name: string) => name === 'pi-question-disabled');

		questionnaire(mockPi);

		// Tool is still registered
		expect(mockPi.registerTool).toHaveBeenCalledTimes(1);
		const registeredTool = mockPi.registerTool.mock.calls[0][0];

		// No manipulation of the active tools list
		expect(mockPi.setActiveTools).not.toHaveBeenCalled();

		// Calling the tool must return the disabled rejection
		const result = await registeredTool.execute(
			'call-id',
			{
				questions: [
					{
						questionTopic: 'Topic',
						prompt: 'Pick one',
						type: 'single',
						options: [{ value: 'a', label: 'A' }],
					},
				],
			},
			new AbortController().signal,
			vi.fn(),
			{ hasUI: true },
		);

		expect(result.content[0].text).toContain('Question extension is disabled');
		expect(result.details).toHaveProperty('cancelled', true);
	});
});
