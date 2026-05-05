import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
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
});
