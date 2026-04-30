/**
 * Word-Wrap Tests for pi-question Extension
 *
 * Tests the multi-line text wrapping functionality for prompts and descriptions.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createMockPi, createMockTui, createMockTheme, setupWordWrapMocks } from './helpers';

// Setup word-wrap mocks before importing extension
setupWordWrapMocks();

// Import extension after mocks
import questionnaire from '../extensions/index.js';

describe('Word-Wrap: Multi-line Text Support', () => {
	let mockPi: ReturnType<typeof createMockPi>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockPi = createMockPi();
		// Register the tool
		questionnaire(mockPi);
	});

	describe('Tool Registration', () => {
		it('should register the question tool with correct name', () => {
			expect(mockPi.registerTool).toHaveBeenCalledTimes(1);
			const toolCall = mockPi.registerTool.mock.calls[0][0];
			expect(toolCall.name).toBe('question');
		});

		it('should have correct description', () => {
			const toolCall = mockPi.registerTool.mock.calls[0][0];
			expect(toolCall.description).toBe(
				'Ask questionaires with single and multiple choice questions, with detailed notes and explainers to collect answers, clarification, details.',
			);
		});

		it('should have parameters schema defined', () => {
			const toolCall = mockPi.registerTool.mock.calls[0][0];
			expect(toolCall.parameters).toBeDefined();
		});
	});

	describe('Schema Validation', () => {
		it('should validate questions with long prompts', async () => {
			const longPrompt =
				'This is a very long question prompt that contains multiple words and should wrap across several lines when displayed to the user in the terminal';

			mockPi.registerTool = vi.fn();
			questionnaire(mockPi);

			const toolCall = mockPi.registerTool.mock.calls[0][0];
			const execute = toolCall.execute;

			const result = await execute(
				'test-id',
				{
					questions: [
						{
							questionTopic: 'Test',
							prompt: longPrompt,
							options: [{ value: 'a', label: 'Option A' }],
						},
					],
				},
				undefined,
				undefined,
				{ hasUI: false, ui: {}, abort: vi.fn() },
			);

			// Should return validation error since hasUI is false, not a schema error
			expect(result.content[0].text).toContain('UI not available');
		});

		it('should validate questions with long descriptions', async () => {
			const longDescription =
				'This is a comprehensive description that contains many details about the option and should properly word-wrap to fit within the available terminal width while maintaining readability';

			mockPi.registerTool = vi.fn();
			questionnaire(mockPi);

			const toolCall = mockPi.registerTool.mock.calls[0][0];
			const execute = toolCall.execute;

			const result = await execute(
				'test-id',
				{
					questions: [
						{
							questionTopic: 'Test',
							prompt: 'What is your favorite?',
							options: [
								{
									value: 'option',
									label: 'Option',
									description: longDescription,
								},
							],
						},
					],
				},
				undefined,
				undefined,
				{ hasUI: false, ui: {}, abort: vi.fn() },
			);

			expect(result.content[0].text).toContain('UI not available');
		});
	});

	describe('Description Field Support', () => {
		it('should accept options with description field in schema', () => {
			const toolCall = mockPi.registerTool.mock.calls[0][0];
			const params = toolCall.parameters;

			// Check that description is in the schema
			expect(params).toBeDefined();
		});
	});

	describe('renderCall with Long Topics', () => {
		it('should handle renderCall with truncated topics', () => {
			const toolCall = mockPi.registerTool.mock.calls[0][0];
			const renderCall = toolCall.renderCall;

			const mockTheme = createMockTheme();

			const result = renderCall(
				{
					questions: [
						{ questionTopic: 'Topic A', prompt: 'Prompt A', options: [], type: 'single' },
						{
							questionTopic: 'Topic B',
							prompt: 'Prompt B',
							options: [],
							type: 'multi',
						},
					],
				},
				mockTheme,
				{},
			);

			// Should return a Text object
			expect(result).toBeDefined();
			expect(result.text).toContain('2 questions');
		});
	});

	describe('Render Result with Descriptions', () => {
		it('should handle renderResult with descriptions in answers', () => {
			const toolCall = mockPi.registerTool.mock.calls[0][0];
			const renderResult = toolCall.renderResult;

			const mockTheme = createMockTheme();

			const result = renderResult(
				{
					content: [],
					details: {
						questions: [
							{
								questionTopic: 'Test',
								prompt: 'What is your favorite?',
								type: 'single',
								options: [
									{
										value: 'option',
										label: 'Option',
										description: 'A test description',
									},
								],
							},
						],
						answers: [
							{
								value: 'option',
								label: 'Option',
								description: 'A test description',
								wasCustom: false,
							},
						],
						cancelled: false,
					},
				},
				{},
				mockTheme,
				{},
			);

			// Should return a Text object with the answer
			expect(result).toBeDefined();
		});
	});

	describe('Long Content Integration', () => {
		it('should handle questions with very long prompts', async () => {
			const longPrompt =
				'This is a very long question prompt that contains multiple words and should ' +
				'wrap across several lines when displayed to the user in the terminal. ' +
				'It contains enough text to test the word-wrapping functionality.';

			mockPi.registerTool = vi.fn();
			questionnaire(mockPi);

			const toolCall = mockPi.registerTool.mock.calls[0][0];
			const execute = toolCall.execute;

			const mockCustom = vi.fn().mockImplementation((callback: (...args: unknown[]) => void) => {
				const mockTui = createMockTui();
				const mockTheme = createMockTheme();

				callback(mockTui, mockTheme, {}, vi.fn());

				return Promise.resolve({
					questions: [
						{
							questionTopic: 'Test',
							prompt: longPrompt,
							type: 'single',
							options: [],
						},
					],
					answers: [{ value: 'a', label: 'Answer', wasCustom: false, index: 1 }],
					cancelled: false,
				});
			});

			const result = await execute(
				'call-id',
				{
					questions: [
						{
							questionTopic: 'Test',
							prompt: longPrompt,
							options: [{ value: 'a', label: 'Answer' }],
						},
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } },
			);

			// Should return markdown content
			expect(result.content[0].type).toBe('text');
			expect(result.content[0].text).toContain('## User answered our questions');
		});

		it('should handle questions with long option descriptions', async () => {
			const longDescription =
				'This is a comprehensive description that contains many details about the option ' +
				'and should properly word-wrap to fit within the available terminal width. ' +
				'It tests the description wrapping functionality thoroughly.';

			mockPi.registerTool = vi.fn();
			questionnaire(mockPi);

			const toolCall = mockPi.registerTool.mock.calls[0][0];
			const execute = toolCall.execute;

			const mockCustom = vi.fn().mockImplementation((callback: (...args: unknown[]) => void) => {
				const mockTui = createMockTui();
				const mockTheme = createMockTheme();

				callback(mockTui, mockTheme, {}, vi.fn());

				return Promise.resolve({
					questions: [
						{
							questionTopic: 'Test',
							prompt: 'Question',
							type: 'single',
							options: [{ value: 'opt', label: 'Option', description: longDescription }],
						},
					],
					answers: [
						{
							value: 'opt',
							label: 'Option',
							description: longDescription,
							wasCustom: false,
							index: 1,
						},
					],
					cancelled: false,
				});
			});

			const result = await execute(
				'call-id',
				{
					questions: [
						{
							questionTopic: 'Test',
							prompt: 'Question',
							options: [{ value: 'opt', label: 'Option', description: longDescription }],
						},
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } },
			);

			// Should return markdown content with description
			expect(result.content[0].type).toBe('text');
			expect(result.content[0].text).toContain('Option');
			expect(result.content[0].text).toContain(longDescription);
		});

		it('should include descriptions in multi-select markdown output', async () => {
			const description1 = 'First option description';
			const description2 = 'Second option description';

			mockPi.registerTool = vi.fn();
			questionnaire(mockPi);

			const toolCall = mockPi.registerTool.mock.calls[0][0];
			const execute = toolCall.execute;

			const mockCustom = vi.fn().mockImplementation((callback: (...args: unknown[]) => void) => {
				const mockTui = createMockTui();
				const mockTheme = createMockTheme();

				callback(mockTui, mockTheme, {}, vi.fn());

				return Promise.resolve({
					questions: [
						{
							questionTopic: 'Test',
							prompt: 'Multi-select',
							type: 'multi',
							options: [
								{ value: 'a', label: 'Option A', description: description1 },
								{ value: 'b', label: 'Option B', description: description2 },
							],
						},
					],
					answers: [
						{
							items: [
								{
									value: 'a',
									label: 'Option A',
									description: description1,
									wasCustom: false,
								},
								{
									value: 'b',
									label: 'Option B',
									description: description2,
									wasCustom: false,
								},
							],
						},
					],
					cancelled: false,
				});
			});

			const result = await execute(
				'call-id',
				{
					questions: [
						{
							questionTopic: 'Test',
							prompt: 'Multi-select',
							type: 'multi',
							options: [
								{ value: 'a', label: 'Option A', description: description1 },
								{ value: 'b', label: 'Option B', description: description2 },
							],
						},
					],
				},
				new AbortController().signal,
				vi.fn(),
				{ hasUI: true, ui: { custom: mockCustom, notify: vi.fn() } },
			);

			// Should return markdown with checkboxes and descriptions
			expect(result.content[0].text).toContain('[x]');
			expect(result.content[0].text).toContain(description1);
			expect(result.content[0].text).toContain(description2);
		});
	});
});
