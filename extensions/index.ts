/**
 * Questionnaire Tool v2 - Single-select and multi-select questions
 *
 * Features:
 * - type: "single" (radio) or "multi" (checkbox)
 * - recommended: pre-select and highlight options
 * - "Other" always available for free-form input
 * - Single-select with >1 recommended returns error
 * - Markdown output: single = plain bullet, multi = [x] checkboxes
 */

import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import {
	Editor,
	type EditorTheme,
	Key,
	matchesKey,
	Text,
	truncateToWidth,
} from '@mariozechner/pi-tui';
import { Type } from '@sinclair/typebox';

// Types
interface QuestionOption {
	value: string;
	label: string;
	description?: string;
	recommended?: boolean;
}

type RenderOption = QuestionOption & { isOther?: boolean };

type QuestionType = 'single' | 'multi';

interface Question {
	questionTopic: string;
	prompt: string;
	type: QuestionType;
	options: QuestionOption[];
}

// Answer types - question order implicit in array order
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

type Answer = SingleAnswer | MultiAnswer;

interface QuestionnaireResult {
	questions: Question[];
	answers: Answer[];
	cancelled: boolean;
}

interface PendingOther {
	index: number;
	appended: boolean; // true if other text will be appended to existing selection
}

// Error types
interface QuestionnaireError {
	code: 'MULTIPLE_RECOMMENDED' | 'INVALID_TYPE' | 'EMPTY_OPTIONS';
	message: string;
	questionIndex?: number;
	recommendedCount?: number;
}

// Constants
const OTHER_VALUE = '__other__';
const OTHER_LABEL = 'Other';
const NO_CHOICE = '(no choice)';
const OTHER_INPUT = '(other)';

/* global process */
// Check for non-interactive mode (--print flag)
const isNonInteractive = process.argv.includes('--print') || process.argv.includes('-p');

// Schema
const QuestionOptionSchema = Type.Object(
	{
		value: Type.String(),
		label: Type.String(),
		description: Type.Optional(Type.String()),
		recommended: Type.Optional(Type.Boolean()),
	},
	{ additionalProperties: false },
);

const QuestionSchema = Type.Object(
	{
		questionTopic: Type.String(),
		prompt: Type.String(),
		type: Type.Optional(Type.Union([Type.Literal('single'), Type.Literal('multi')])),
		options: Type.Array(QuestionOptionSchema, { minItems: 1 }),
	},
	{ additionalProperties: false },
);

const QuestionnaireParams = Type.Object(
	{
		questions: Type.Array(QuestionSchema, { minItems: 1 }),
	},
	{ additionalProperties: false },
);

function errorResult(
	message: string,
	error: QuestionnaireError,
): {
	content: { type: 'text'; text: string }[];
	details: QuestionnaireResult;
	error: QuestionnaireError;
} {
	return {
		content: [{ type: 'text', text: message }],
		details: { questions: [], answers: [], cancelled: true },
		error,
	};
}

function validationError(
	message: string,
	questions: Question[] = [],
): { content: { type: 'text'; text: string }[]; details: QuestionnaireResult } {
	return {
		content: [{ type: 'text', text: message }],
		details: { questions, answers: [], cancelled: true },
	};
}

export default function question(pi: ExtensionAPI) {
	// Skip tool registration in non-interactive mode (e.g., --print)
	if (isNonInteractive) {
		return;
	}

	pi.registerTool({
		name: 'question',
		label: 'Question',
		description:
			'Collect single/multiple choice answers with optional notes. Output: markdown.',
		parameters: QuestionnaireParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (!ctx.hasUI) {
				return validationError(
					'Error: UI not available (running in non-interactive mode)',
					[],
				);
			}
			if (!params.questions || params.questions.length === 0) {
				return validationError('Error: No questions provided', []);
			}

			// Normalize questions with defaults
			const questions: Question[] = params.questions.map((q) => ({
				questionTopic: q.questionTopic,
				prompt: q.prompt,
				type: q.type || 'single',
				options: q.options,
			}));

			// Validate: single-select with multiple recommended = error
			for (let i = 0; i < questions.length; i++) {
				const q = questions[i];
				if (!q) continue;
				if (q.type === 'single') {
					const recommendedCount = q.options.filter((o) => o.recommended).length;
					if (recommendedCount > 1) {
						return errorResult(
							`Error: Question ${i + 1} is single-select but has ${recommendedCount} recommended options`,
							{
								code: 'MULTIPLE_RECOMMENDED',
								message: `Single-select question ${i + 1} has ${recommendedCount} recommended options, expected at most 1`,
								questionIndex: i,
								recommendedCount,
							},
						);
					}
				}
			}

			const isMulti = questions.length > 1;
			const totalTabs = questions.length + 1; // questions + Submit

			const result = await ctx.ui.custom<QuestionnaireResult>((tui, theme, _kb, done) => {
				// State
				let currentTab = 0;
				let optionIndex = 0;
				let inputMode = false;
				let inputQuestionIndex: number | null = null;
				let cachedLines: string[] | undefined;
				const answers = new Map<number, Answer>();
				let pendingOther: PendingOther | null = null;
				let messageMode = false;
				let repromptMode = false;
				let repromptMessage = '';

				// For multi-select: track which options are selected
				const selectedOptions = new Map<number, Set<number>>();

				// Sort options: recommended first, preserve order within groups
				const sortedQuestions: Question[] = questions.map((q) => ({
					...q,
					options: [...q.options].sort((a, b) => {
						if (a.recommended && !b.recommended) return -1;
						if (!a.recommended && b.recommended) return 1;
						return 0;
					}),
				}));

				// Initialize selected options with recommended (using sorted indices)
				for (let i = 0; i < sortedQuestions.length; i++) {
					const q = sortedQuestions[i];
					if (!q) continue;
					if (q.type === 'multi') {
						const selected = new Set<number>();
						q.options.forEach((opt, idx) => {
							if (opt.recommended) {
								selected.add(idx);
							}
						});
						selectedOptions.set(i, selected);
					}
				}

				// Find first recommended option index for cursor initialization
				function getFirstRecommendedIndex(opts: QuestionOption[]): number {
					for (let i = 0; i < opts.length; i++) {
						const opt = opts[i];
						if (opt && opt.recommended) return i;
					}
					return 0;
				}

				// Initialize cursor to first recommended (or 0 if none)
				const firstQuestion = questions[0];
				if (firstQuestion) {
					optionIndex = getFirstRecommendedIndex(firstQuestion.options);
				}

				// Editor for "Other" option and messages
				const editorTheme: EditorTheme = {
					borderColor: (s) => theme.fg('accent', s),
					selectList: {
						selectedPrefix: (t) => theme.fg('accent', t),
						selectedText: (t) => theme.fg('accent', t),
						description: (t) => theme.fg('muted', t),
						scrollInfo: (t) => theme.fg('dim', t),
						noMatch: (t) => theme.fg('warning', t),
					},
				};
				const editor = new Editor(tui, editorTheme);

				// Helpers
				function refresh() {
					cachedLines = undefined;
					tui.requestRender();
				}

				function submit(cancelled: boolean) {
					done({ questions, answers: Array.from(answers.values()), cancelled });
				}

				function currentQuestion(): Question | undefined {
					return questions[currentTab];
				}

				function currentOptions(): RenderOption[] {
					const q = currentSortedQuestion();
					if (!q) return [];
					// Options are sorted by recommended in sortedQuestions (used for display)
					const filteredOptions = q.options.filter((opt) => opt.value !== OTHER_VALUE);
					const opts: RenderOption[] = [...filteredOptions];
					// Other always available at the end
					opts.push({ value: OTHER_VALUE, label: OTHER_LABEL, isOther: true });
					return opts;
				}

				// Get sorted question (for UI purposes, always show recommended first)
				function currentSortedQuestion(): Question | undefined {
					return sortedQuestions[currentTab];
				}

				function allAnswered(): boolean {
					for (let i = 0; i < questions.length; i++) {
						if (!answers.has(i)) return false;
					}
					return true;
				}

				function hasAnyAnswer(): boolean {
					return answers.size > 0;
				}

				function isMultiSelect(): boolean {
					const q = currentQuestion();
					return q?.type === 'multi';
				}

				function isOptionSelected(displayIdx: number): boolean {
					const q = currentQuestion();
					if (!q) return false;
					if (q.type === 'multi') {
						const sortedQ = currentSortedQuestion();
						if (!sortedQ) return false;
						const opt = sortedQ.options[displayIdx];
						if (!opt) return false;
						const originalIndex = q.options.indexOf(opt);
						if (originalIndex === -1) return false;
						return selectedOptions.get(currentTab)?.has(originalIndex) ?? false;
					}
					return optionIndex === displayIdx;
				}

				function toggleOption(idx: number) {
					const q = currentQuestion();
					if (!q || q.type !== 'multi') return;
					const selected = selectedOptions.get(currentTab);
					if (!selected) return;
					if (selected.has(idx)) {
						selected.delete(idx);
					} else {
						selected.add(idx);
					}
				}

				function advanceAfterAnswer() {
					if (!isMulti) {
						submit(false);
						return;
					}
					if (currentTab < questions.length - 1) {
						currentTab++;
					} else {
						currentTab = questions.length; // Submit tab
					}
					// Reset cursor to first recommended (or 0) on the new question
					const nextQ = currentSortedQuestion();
					optionIndex = nextQ ? getFirstRecommendedIndex(nextQ.options) : 0;
					refresh();
				}

				function saveSingleAnswer(
					questionIndex: number,
					value: string,
					label: string,
					wasCustom: boolean,
					index?: number,
					message?: string,
				) {
					const answer: SingleAnswer = {
						value,
						label,
						wasCustom,
						index,
						message,
					};
					answers.set(questionIndex, answer);
				}

				function saveMultiAnswer(
					questionIndex: number,
					values: string[],
					labels: string[],
					wasCustom: boolean[],
				) {
					const answer: MultiAnswer = {
						values,
						labels,
						wasCustom,
					};
					answers.set(questionIndex, answer);
				}

				function getSelectedValues(): {
					values: string[];
					labels: string[];
					wasCustom: boolean[];
				} {
					const q = currentQuestion();
					if (!q || q.type !== 'multi') {
						return { values: [], labels: [], wasCustom: [] };
					}
					const selected = selectedOptions.get(currentTab);
					if (!selected) {
						return { values: [], labels: [], wasCustom: [] };
					}
					const values: string[] = [];
					const labels: string[] = [];
					const wasCustom: boolean[] = [];
					for (const idx of selected) {
						const opt = q.options[idx];
						if (opt) {
							values.push(opt.value);
							labels.push(opt.label);
							wasCustom.push(false);
						}
					}
					return { values, labels, wasCustom };
				}

				function showMessagePrompt(questionIndex: number, appended: boolean) {
					pendingOther = { index: questionIndex, appended };
					messageMode = true;
					// Pre-populate editor with existing note if editing
					const existingAnswer = answers.get(questionIndex);
					if (existingAnswer && 'message' in existingAnswer && existingAnswer.message) {
						editor.setText(existingAnswer.message);
					} else {
						editor.setText('');
					}
					// Pre-save the current selection for single-select
					// This ensures the answer is recorded even if user skips the note
					const q = questions[questionIndex];
					if (q && q.type !== 'multi') {
						const opt = currentOptions()[optionIndex];
						if (opt && !opt.isOther) {
							saveSingleAnswer(questionIndex, opt.value, opt.label, false, optionIndex + 1);
						}
					}
					refresh();
				}

				function submitPendingWithMessage(msg: string) {
					if (!pendingOther) return;
					const trimmedMsg = msg.trim();
					const q = questions[pendingOther.index];
					if (!q) return;

					if (q.type === 'multi') {
						const { values, labels, wasCustom } = getSelectedValues();
						if (pendingOther.appended) {
							if (trimmedMsg) {
								values.push(OTHER_INPUT);
								labels.push(trimmedMsg);
								wasCustom.push(true);
							}
						}
						saveMultiAnswer(pendingOther.index, values, labels, wasCustom);
					} else {
						// For single-select: save the currently highlighted option (not Other)
						const opt = currentOptions()[optionIndex];
						if (opt && !opt.isOther) {
							if (trimmedMsg) {
								saveSingleAnswer(
									pendingOther.index,
									opt.value,
									opt.label,
									false,
									optionIndex + 1,
									trimmedMsg,
								);
							} else {
								saveSingleAnswer(
									pendingOther.index,
									opt.value,
									opt.label,
									false,
									optionIndex + 1,
									undefined,
								);
							}
						} else if (trimmedMsg) {
							saveSingleAnswer(
								pendingOther.index,
								OTHER_INPUT,
								trimmedMsg,
								true,
								undefined,
								trimmedMsg,
							);
						} else {
							saveSingleAnswer(
								pendingOther.index,
								NO_CHOICE,
								'(no choice)',
								false,
								undefined,
								undefined,
							);
						}
					}

					pendingOther = null;
					messageMode = false;
					advanceAfterAnswer();
				}

				function skipMessageAndSubmit() {
					if (!pendingOther) return;
					const q = questions[pendingOther.index];
					if (!q) return;

					if (q.type === 'multi') {
						const { values, labels, wasCustom } = getSelectedValues();
						if (pendingOther.appended) {
							if (values.length === 0) {
								values.push(NO_CHOICE);
								labels.push('(no choice)');
								wasCustom.push(false);
							}
						}
						saveMultiAnswer(pendingOther.index, values, labels, wasCustom);
					} else {
						// For single-select: save the currently highlighted option (not Other)
						const opt = currentOptions()[optionIndex];
						if (opt && !opt.isOther) {
							saveSingleAnswer(
								pendingOther.index,
								opt.value,
								opt.label,
								false,
								optionIndex + 1,
								undefined,
							);
						} else {
							saveSingleAnswer(
								pendingOther.index,
								NO_CHOICE,
								'(no choice)',
								false,
								undefined,
								undefined,
							);
						}
					}

					pendingOther = null;
					messageMode = false;
					advanceAfterAnswer();
				}

				// Editor submit callback
				editor.onSubmit = (value) => {
					if (messageMode && pendingOther) {
						submitPendingWithMessage(value);
						return;
					}

					if (inputQuestionIndex === null) return;
					const trimmed = value.trim();
					const q = questions[inputQuestionIndex];
					if (!q) return;

					// Require non-empty input for Other
					if (!trimmed) {
						return; // Stay in input mode, user must type or Escape
					}

					if (q.type === 'multi') {
						const { values, labels, wasCustom } = getSelectedValues();
						values.push(OTHER_INPUT);
						labels.push(trimmed);
						wasCustom.push(true);
						saveMultiAnswer(inputQuestionIndex, values, labels, wasCustom);
					} else {
						saveSingleAnswer(
							inputQuestionIndex,
							OTHER_INPUT,
							trimmed,
							true,
							undefined,
							undefined,
						);
					}

					inputMode = false;
					inputQuestionIndex = null;
					editor.setText('');
					advanceAfterAnswer();
				};

				function handleInput(data: string) {
					if (messageMode) {
						if (matchesKey(data, Key.escape)) {
							// Keep the typed text in editor - user might come back
							pendingOther = null;
							messageMode = false;
							// editor.setText('');  // Don't clear - preserve for potential edit
							refresh();
							return;
						}
						if (matchesKey(data, Key.tab)) {
							const text = editor.getText();
							if (text.trim()) {
								submitPendingWithMessage(text);
							} else {
								skipMessageAndSubmit();
							}
							return;
						}
						editor.handleInput(data);
						refresh();
						return;
					}

					if (inputMode) {
						if (matchesKey(data, Key.escape)) {
							inputMode = false;
							inputQuestionIndex = null;
							editor.setText('');
							refresh();
							return;
						}
						editor.handleInput(data);
						refresh();
						return;
					}

					const q = currentQuestion();
					const opts = currentOptions();
					const isMultiQ = isMultiSelect();

					if (isMulti) {
						if (matchesKey(data, Key.right)) {
							if (currentTab === questions.length && !hasAnyAnswer()) {
								// Cannot navigate away from submit tab without answering at least one question
								repromptMode = true;
								repromptMessage =
									'You must answer at least one question before submitting';
								refresh();
								return;
							}
							currentTab = (currentTab + 1) % totalTabs;
							const nextQ = currentSortedQuestion();
							optionIndex = nextQ ? getFirstRecommendedIndex(nextQ.options) : 0;
							refresh();
							return;
						}
						if (matchesKey(data, Key.left)) {
							currentTab = (currentTab - 1 + totalTabs) % totalTabs;
							const prevQ = currentSortedQuestion();
							optionIndex = prevQ ? getFirstRecommendedIndex(prevQ.options) : 0;
							refresh();
							return;
						}
					}

					if (currentTab === questions.length) {
						// Exit reprompt mode on any key - go back to last unanswered question
						if (repromptMode) {
							repromptMode = false;
							repromptMessage = '';
							// Go back to first unanswered question (or last question if all answered)
							let targetTab = 0;
							for (let i = 0; i < questions.length; i++) {
								if (!answers.has(i)) {
									targetTab = i;
									break;
								}
								if (i === questions.length - 1) {
									targetTab = i; // All answered, stay on last
								}
							}
							currentTab = targetTab;
							const prevQ = currentSortedQuestion();
							optionIndex = prevQ ? getFirstRecommendedIndex(prevQ.options) : 0;
							refresh();
							return;
						}
						if (matchesKey(data, Key.enter) && allAnswered()) {
							submit(false);
						} else if (matchesKey(data, Key.escape)) {
							submit(true);
						}
						return;
					}

					if (matchesKey(data, Key.up)) {
						optionIndex = Math.max(0, optionIndex - 1);
						refresh();
						return;
					}
					if (matchesKey(data, Key.down)) {
						optionIndex = Math.min(opts.length - 1, optionIndex + 1);
						refresh();
						return;
					}

					if (matchesKey(data, Key.space) && q) {
						if (isMultiQ) {
							toggleOption(optionIndex);
							refresh();
							return;
						}
					}

					if (matchesKey(data, Key.enter) && q) {
						const opt = currentOptions()[optionIndex];
						if (!opt) return;
						if (opt.isOther) {
							inputMode = true;
							inputQuestionIndex = currentTab;
							editor.setText('');
							refresh();
							return;
						}

						if (isMultiQ) {
							const { values, labels, wasCustom } = getSelectedValues();
							if (values.length === 0) {
								values.push(NO_CHOICE);
								labels.push('(no choice)');
								wasCustom.push(false);
							}
							saveMultiAnswer(currentTab, values, labels, wasCustom);
							advanceAfterAnswer();
							return;
						}

						saveSingleAnswer(currentTab, opt.value, opt.label, false, optionIndex + 1);
						advanceAfterAnswer();
						return;
					}

					if (matchesKey(data, Key.tab) && q) {
						const opt = currentOptions()[optionIndex];
						if (!opt) return;

						if (isMultiQ) {
							if (!opt.isOther) {
								toggleOption(optionIndex);
							}
							showMessagePrompt(currentTab, true);
						} else {
							showMessagePrompt(currentTab, false);
						}
						return;
					}

					if (matchesKey(data, Key.escape)) {
						submit(true);
					}
				}

				function render(width: number): string[] {
					if (cachedLines) return cachedLines;

					const lines: string[] = [];
					const q = currentQuestion();
					const opts = currentOptions();
					const isMultiQ = isMultiSelect();

					const add = (s: string) => lines.push(truncateToWidth(s, width));

					add(theme.fg('accent', '─'.repeat(width)));

					if (isMulti) {
						const tabs: string[] = ['← '];
						for (let i = 0; i < questions.length; i++) {
							const qAtIdx = questions[i];
							if (!qAtIdx) continue;
							const isActive = i === currentTab;
							const isAnswered = answers.has(i);
							const box = isAnswered ? '■' : '□';
							const color = isAnswered ? 'success' : 'muted';
							const text = ` ${box} ${qAtIdx.questionTopic} `;
							const styled = isActive
								? theme.bg('selectedBg', theme.fg('text', text))
								: theme.fg(color, text);
							tabs.push(`${styled} `);
						}
						const canSubmit = allAnswered();
						const isSubmitTab = currentTab === questions.length;
						const submitText = ' ✓ Submit ';
						const submitStyled = isSubmitTab
							? theme.bg('selectedBg', theme.fg('text', submitText))
							: theme.fg(canSubmit ? 'success' : 'dim', submitText);
						tabs.push(`${submitStyled} →`);
						add(` ${tabs.join('')}`);
						lines.push('');
					}

					function renderOptions() {
						for (let i = 0; i < opts.length; i++) {
							const opt = opts[i];
							if (!opt) continue;
							const selected = isOptionSelected(i);
							const isCursor = i === optionIndex;
							const isOther = opt.isOther === true;
							const isRecommended = !isOther && opt.recommended;

							let prefix: string;
							if (isMultiQ) {
								const cursorMark = isCursor ? theme.fg('accent', '>') + ' ' : '  ';
								const checkMark = selected
									? theme.fg('accent', '☑')
									: theme.fg('muted', '☐');
								prefix = cursorMark + checkMark + ' ';
							} else {
								prefix = isCursor
									? theme.fg('accent', '> ● ')
									: theme.fg('muted', '  ○ ');
							}

							const selectedColor = selected ? 'accent' : 'text';
							let labelText = `${i + 1}. ${opt.label}`;

							if (isRecommended) {
								labelText += ` ${theme.fg('success', '(Recommended)')}`;
							}

							if (isOther && inputMode) {
								add(prefix + theme.fg('accent', labelText + ' ✎'));
							} else {
								add(prefix + theme.fg(selectedColor, labelText));
							}
							if (opt.description) {
								add(`       ${theme.fg('muted', opt.description)}`);
							}
						}
					}

					if (inputMode && q) {
						add(theme.fg('text', ` ${q.prompt}`));
						lines.push('');
						if (isMultiQ) {
							const { labels } = getSelectedValues();
							if (labels.length > 0) {
								add(theme.fg('muted', ` Selected: ${labels.join(', ')}`));
								lines.push('');
							}
						}
						// For Other: show only input field, not options
						lines.push('');
						add(theme.fg('muted', ' Your answer:'));
						const typedText = editor.getText();
						if (typedText) {
							add(` ${typedText}`);
						}
						for (const line of editor.render(width - 2)) {
							add(` ${line}`);
						}
						lines.push('');
						add(theme.fg('dim', ' Enter to submit • Esc to cancel'));
					} else if (messageMode && q) {
						add(theme.fg('text', ` ${q.prompt}`));
						lines.push('');

						if (isMultiQ) {
							const { labels } = getSelectedValues();
							if (labels.length > 0) {
								add(
									theme.fg('muted', ` Selected: `) +
										theme.fg('accent', labels.join(', ')),
								);
							} else {
								add(theme.fg('muted', ` No options selected`));
							}
						} else {
							const selectedOpt = opts[optionIndex];
							// Check for saved note on this question
							const savedAnswer = answers.get(currentTab);
							let noteDisplay = '';
							if (savedAnswer && 'message' in savedAnswer && savedAnswer.message) {
								noteDisplay = ` ${theme.fg('success', `(note: "${savedAnswer.message}")`)}`;
							}
							add(
								theme.fg('muted', ` Selected: `) +
									theme.fg('accent', selectedOpt?.label || '') +
									noteDisplay,
							);
						}
						lines.push('');
						add(theme.fg('muted', ' Add note (optional):'));
						// Show typed text (editor.getText()) and rendered content
						const typedText = editor.getText();
						if (typedText) {
							add(` ${typedText}`);
						}
						for (const line of editor.render(width - 2)) {
							add(` ${line}`);
						}
						lines.push('');
						add(theme.fg('dim', ' Enter/Tab save • Esc discard'));
					} else if (currentTab === questions.length) {
						if (repromptMode) {
							add(theme.fg('warning', ` ⚠ ${repromptMessage}`));
							lines.push('');
							add(
								theme.fg(
									'muted',
									' Press any key to continue answering questions...',
								),
							);
							lines.push('');
							lines.push('');
							add(theme.fg('accent', theme.bold(' Answers so far:')));
							lines.push('');
							if (answers.size === 0) {
								add(theme.fg('muted', ' (no questions answered yet)'));
							}
						} else {
							add(theme.fg('accent', theme.bold(' Ready to submit')));
							lines.push('');
							for (let i = 0; i < questions.length; i++) {
								const question = questions[i];
								if (!question) continue;
								const answer = answers.get(i);
								if (answer) {
									if (question.type === 'multi') {
										const multiAnswer = answer as MultiAnswer;
										const valuesStr = multiAnswer.labels.join(', ') || '(none)';
										add(
											`${theme.fg('muted', ` ${question.questionTopic}: `)}${theme.fg('text', valuesStr)}`,
										);
									} else {
										const singleAnswer = answer as SingleAnswer;
										const prefix = singleAnswer.wasCustom ? '(custom) ' : '';
										add(
											`${theme.fg('muted', ` ${question.questionTopic}: `)}${theme.fg('text', prefix + singleAnswer.label)}`,
										);
										if (singleAnswer.message) {
											add(
												`     ${theme.fg('muted', `Note: "${singleAnswer.message}"`)}`,
											);
										}
									}
								}
							}
							lines.push('');
							if (allAnswered()) {
								add(theme.fg('success', ' Press Enter to submit'));
							} else {
								const missing = questions
									.filter((_, i) => !answers.has(i))
									.map((qq) => qq.questionTopic)
									.join(', ');
								add(theme.fg('warning', ` Unanswered: ${missing}`));
							}
						}
					} else if (q) {
						add(theme.fg('muted', ` ${q.prompt}`));
						lines.push('');
						renderOptions();
					}

					lines.push('');
					if (!inputMode && !messageMode) {
						if (repromptMode) {
							add(theme.fg('warning', ' ↑↓←→ Answer a question • Esc cancel'));
						} else {
							const help = isMulti
								? isMultiQ
									? ' ←→ navigate • ↑↓ select • Space☐ toggle • Tab↹ add note • Enter confirm • Esc cancel'
									: ' ←→ navigate • ↑↓ select • Tab↹ add note • Enter confirm • Esc cancel'
								: isMultiQ
									? ' ↑↓ select • Space☐ toggle • Tab↹ add note • Enter confirm • Esc cancel'
									: ' ↑↓ navigate • Enter select • Tab↹ add note • Esc cancel';
							add(theme.fg('dim', help));
						}
					}
					add(theme.fg('accent', '─'.repeat(width)));

					cachedLines = lines;
					return lines;
				}

				return {
					render,
					invalidate: () => {
						cachedLines = undefined;
					},
					handleInput,
				};
			});

			if (result.cancelled) {
				ctx.abort();
				pi.sendMessage(
					{
						customType: 'questionnaire-cancelled',
						content: 'User did not answer the questions',
						display: false,
					},
					{ deliverAs: 'nextTurn' },
				);
				return {
					content: [{ type: 'text', text: 'User cancelled the question' }],
					details: result,
				};
			}

			// Format answers as markdown sections
			const lines: string[] = [];
			lines.push('## User answered our questions');
			lines.push('');
			for (let i = 0; i < questions.length; i++) {
				const q = questions[i];
				if (!q) continue;
				const answer = result.answers[i];

				if (!answer) continue;

				lines.push(`### ${q.prompt}`);

				if (q.type === 'multi') {
					const multiAnswer = answer as MultiAnswer;
					for (const label of multiAnswer.labels) {
						lines.push(`- [x] ${label}`);
					}
					if (multiAnswer.labels.length === 0) {
						lines.push(`- (no selection)`);
					}
				} else {
					const singleAnswer = answer as SingleAnswer;
					lines.push(`- ${singleAnswer.label}`);
					if (singleAnswer.message) {
						lines.push(`  Note: "${singleAnswer.message}"`);
					}
				}

				lines.push('');
			}

			return {
				content: [{ type: 'text', text: lines.join('\n') }],
				details: result,
			};
		},

		renderCall(args, theme, _context) {
			const qs = (args.questions as Question[]) || [];
			const count = qs.length;
			const topics = qs.map((q) => q.questionTopic).join(', ');
			let text = theme.fg('toolTitle', theme.bold('question '));
			text += theme.fg('muted', `${count} question${count !== 1 ? 's' : ''}`);
			if (topics) {
				text += theme.fg('dim', ` (${truncateToWidth(topics, 40)})`);
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, _options, theme, _context) {
			const details = result.details as QuestionnaireResult | undefined;
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === 'text' ? text.text : '', 0, 0);
			}
			if (details.cancelled) {
				return new Text(theme.fg('warning', 'Cancelled'), 0, 0);
			}

			const lines: string[] = [];
			lines.push('## User answered our questions');
			lines.push('');
			for (let i = 0; i < details.questions.length; i++) {
				const q = details.questions[i];
				if (!q) continue;
				const answer = details.answers[i];
				if (!answer) continue;

				lines.push(`### ${q.prompt}`);

				if (q.type === 'multi') {
					const multiAnswer = answer as MultiAnswer;
					for (const label of multiAnswer.labels) {
						lines.push(`- [x] ${label}`);
					}
					if (multiAnswer.labels.length === 0) {
						lines.push(`- (no selection)`);
					}
				} else {
					const singleAnswer = answer as SingleAnswer;
					lines.push(`- ${singleAnswer.label}`);
					if (singleAnswer.message) {
						lines.push(`  Note: "${singleAnswer.message}"`);
					}
				}

				lines.push('');
			}

			return new Text(lines.join('\n'), 0, 0);
		},
	});

}
