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
	parseKey,
	Text,
	truncateToWidth,
	visibleWidth,
	wrapTextWithAnsi,
} from '@mariozechner/pi-tui';
// Schema imports - QuestionnaireParamsSchema re-exports QuestionOptionSchema and QuestionSchema internally
import { QuestionnaireParamsSchema } from './schema.js';

// Formatters
import { formatAnswersMarkdown, formatAnswersDisplay } from './formatters/index.js';

// Types
import type { QuestionnaireError } from './types/index.js';
import type {
	Answer,
	MultiAnswer,
	MultiAnswerItem,
	Question,
	QuestionOption,
	QuestionnaireResult,
	SingleAnswer,
} from './types/index.js';

type RenderOption = QuestionOption & { isOther?: boolean };

// Constants
const OTHER_VALUE = '__other__';
const OTHER_LABEL = 'Other';
const OTHER_INPUT = '(other)';

// Word-wrap helper constants
const MAX_WRAP_LINES = 7;

/**
 * Wrap text to fit within width, preserving ANSI codes and capping at max lines.
 * Uses wrapTextWithAnsi for ANSI-aware word wrapping.
 */
function wrapText(text: string, width: number, maxLines: number = MAX_WRAP_LINES): string[] {
	const wrapped = wrapTextWithAnsi(text, width);
	if (wrapped.length <= maxLines) {
		return wrapped;
	}
	// Cap at maxLines: show first (maxLines - 1) lines + truncated last line
	const result = wrapped.slice(0, maxLines - 1);
	const lastLineWidth = Math.max(0, width - 4); // Leave room for "..."
	result.push(truncateToWidth(wrapped[maxLines - 1] || '', lastLineWidth) + ' ...');
	return result;
}

/**
 * Add wrapped, styled text lines to the output.
 * Wraps text and applies the same styling function to each line.
 */
function addWrappedText(
	text: string,
	width: number,
	styleFn: (s: string) => string,
	add: (s: string) => void,
): void {
	const wrapped = wrapText(text, width);
	for (const line of wrapped) {
		add(styleFn(line));
	}
}

/**
 * Add wrapped text with a prefix/indent on all lines.
 * Useful for descriptions that need consistent indentation.
 */
function addWrappedTextWithPrefix(
	text: string,
	width: number,
	prefix: string,
	styleFn: (s: string) => string,
	add: (s: string) => void,
): void {
	const prefixWidth = visibleWidth(prefix);
	const contentWidth = Math.max(1, width - prefixWidth);
	const wrapped = wrapText(text, contentWidth);
	for (let i = 0; i < wrapped.length; i++) {
		const linePrefix = i === 0 ? prefix : prefix;
		add(styleFn(linePrefix + wrapped[i]));
	}
}

/* global process */
// Check for non-interactive mode (--print flag)
const isNonInteractive = process.argv.includes('--print') || process.argv.includes('-p');

// Extension state - controlled via commands and flags
let isExtensionDisabled = false;

function shouldSkipRegistration(): boolean {
	return isNonInteractive || isExtensionDisabled;
}

// Re-use helper from types module
function validationError(
	message: string,
	questions: Question[] = [],
): { content: { type: 'text'; text: string }[]; details: QuestionnaireResult } {
	return {
		content: [{ type: 'text', text: message }],
		details: { questions, answers: [], cancelled: true },
	};
}

// Create error result (inline to avoid circular import)
function createErrorResult(
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

export default function question(pi: ExtensionAPI) {
	// Skip tool registration in non-interactive mode or when disabled
	if (shouldSkipRegistration()) {
		return;
	}

	// Register commands for enabling/disabling the extension
	pi.registerCommand('pi-question:disabled', {
		description: 'Disable the pi-question extension',
		// eslint-disable-next-line require-await
		handler: async (_args, ctx) => {
			isExtensionDisabled = true;
			// Remove question tool from active tools
			const activeTools = pi.getActiveTools();
			const filteredTools = activeTools.filter((t) => t !== 'question');
			pi.setActiveTools(filteredTools);
			ctx.ui.notify('pi-question extension disabled', 'info');
		},
	});

	pi.registerCommand('pi-question:enabled', {
		description: 'Enable the pi-question extension',
		// eslint-disable-next-line require-await
		handler: async (_args, ctx) => {
			isExtensionDisabled = false;
			// Add question tool back to active tools if not present
			const activeTools = pi.getActiveTools();
			if (!activeTools.includes('question')) {
				pi.setActiveTools([...activeTools, 'question']);
			}
			ctx.ui.notify('pi-question extension enabled', 'info');
		},
	});

	// Register flag for disabling via CLI
	pi.registerFlag('pi-question-disabled', {
		description: 'Disable the pi-question extension',
		type: 'boolean',
		default: false,
	});

	// Check if flag was set at startup
	if (pi.getFlag('pi-question-disabled')) {
		isExtensionDisabled = true;
		// Remove question tool from active tools at startup
		const activeTools = pi.getActiveTools();
		const filteredTools = activeTools.filter((t) => t !== 'question');
		pi.setActiveTools(filteredTools);
	}

	pi.registerTool({
		name: 'question',
		label: 'Question',
		description:
			'Present a question to the user and collect their answer.\n\n- Single select: user picks one option\n- Multi select: user picks one or more options.\n\nReturns answers in a clean markdown format.\n\nThe user may give Other answers too.',
		parameters: QuestionnaireParamsSchema,

		// fallow-ignore-next-line complexity
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
						return createErrorResult(
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
				let repromptMode = false;
				let repromptMessage = '';
				let requireSelectionMode = false;
				let noteOptionIndex: number | null = null;

				// For multi-select: track which options are selected
				const selectedOptions = new Map<number, Set<number>>();

				// For multi-select: track notes for selected items
				const selectedNotes = new Map<number, Map<number, string>>();

				// Sort options: recommended first, preserve order within groups
				const sortedQuestions: Question[] = questions.map((q) => ({
					...q,
					options: [...q.options].sort((a, b) => {
						if (a.recommended && !b.recommended) return -1;
						if (!a.recommended && b.recommended) return 1;
						return 0;
					}),
				}));

				// Initialize selected options with recommended (using ORIGINAL indices)
				for (let i = 0; i < sortedQuestions.length; i++) {
					const sortedQ = sortedQuestions[i];
					const originalQ = questions[i];
					if (!sortedQ || !originalQ) continue;
					if (sortedQ.type === 'multi') {
						const selected = new Set<number>();
						sortedQ.options.forEach((opt) => {
							if (opt.recommended) {
								// Find original index in the UNSORTED original array
								const originalIdx = originalQ.options.indexOf(opt);
								if (originalIdx !== -1) {
									selected.add(originalIdx);
								}
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
				const firstSortedQ = sortedQuestions[0];
				if (firstSortedQ) {
					optionIndex = getFirstRecommendedIndex(firstSortedQ.options);
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
					const filteredOptions = q.options.filter(
						(opt) =>
							opt.value !== OTHER_VALUE &&
							opt.label.toLowerCase() !== OTHER_LABEL.toLowerCase(),
					);
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

				function toggleOption(displayIdx: number) {
					const q = currentQuestion();
					const sortedQ = currentSortedQuestion();
					if (!q || !sortedQ || q.type !== 'multi') return;
					const selected = selectedOptions.get(currentTab);
					if (!selected) return;
					// Convert display index to original index
					const opt = sortedQ.options[displayIdx];
					if (!opt) return;
					const originalIndex = q.options.indexOf(opt);
					if (originalIndex === -1) return;
					if (selected.has(originalIndex)) {
						selected.delete(originalIndex);
					} else {
						selected.add(originalIndex);
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
					description: string | undefined,
					wasCustom: boolean,
					index?: number,
					message?: string,
				) {
					const answer: SingleAnswer = {
						value,
						label,
						description,
						wasCustom,
						index,
						message,
					};
					answers.set(questionIndex, answer);
				}

				function saveMultiAnswer(questionIndex: number, items: MultiAnswerItem[]) {
					const answer: MultiAnswer = { items };
					answers.set(questionIndex, answer);
				}

				function getSelectedItems(): MultiAnswerItem[] {
					const q = currentQuestion();
					if (!q || q.type !== 'multi') {
						return [];
					}
					const selected = selectedOptions.get(currentTab);
					if (!selected || selected.size === 0) {
						return [];
					}
					const notes = selectedNotes.get(currentTab) || new Map();
					const items: MultiAnswerItem[] = [];
					for (const idx of selected) {
						const opt = q.options[idx];
						if (opt) {
							items.push({
								value: opt.value,
								label: opt.label,
								description: opt.description,
								wasCustom: false,
								note: notes.get(idx),
							});
						}
					}
					return items;
				}

				function setItemNote(optionIdx: number, note: string) {
					let notes = selectedNotes.get(currentTab);
					if (!notes) {
						notes = new Map();
						selectedNotes.set(currentTab, notes);
					}
					if (note.trim()) {
						notes.set(optionIdx, note.trim());
					} else {
						notes.delete(optionIdx);
					}
				}

				function showNotePrompt(optionIdx: number) {
					const q = currentQuestion();
					if (!q || q.type !== 'multi') return;
					const notes = selectedNotes.get(currentTab) || new Map();
					const existingNote = notes.get(optionIdx) || '';
					editor.setText(existingNote);
					inputMode = true;
					inputQuestionIndex = currentTab;
					// Store which option we're adding a note to
					noteOptionIndex = optionIdx;
					refresh();
				}

				// Editor submit callback
				editor.onSubmit = (value) => {
					// Handle note input for multi-select items
					if (noteOptionIndex !== null && inputQuestionIndex !== null) {
						setItemNote(noteOptionIndex, value.trim());
						noteOptionIndex = null;
						inputMode = false;
						inputQuestionIndex = null;
						editor.setText('');
						refresh();
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
						const items = getSelectedItems();
						items.push({
							value: OTHER_INPUT,
							label: trimmed,
							description: undefined,
							wasCustom: true,
						});
						saveMultiAnswer(inputQuestionIndex, items);
					} else {
						saveSingleAnswer(
							inputQuestionIndex,
							OTHER_INPUT,
							trimmed,
							undefined,
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

				function handleOtherInput(data: string) {
					if (matchesKey(data, Key.escape)) {
						noteOptionIndex = null;
						inputMode = false;
						inputQuestionIndex = null;
						editor.setText('');
						refresh();
						return true;
					}
					editor.handleInput(data);
					refresh();
					return true;
				}

				function handleMultiNav(data: string) {
					if (matchesKey(data, Key.right)) {
						if (currentTab === questions.length && !hasAnyAnswer()) {
							repromptMode = true;
							repromptMessage =
								'You must answer at least one question before submitting';
							refresh();
							return true;
						}
						currentTab = (currentTab + 1) % totalTabs;
						const nextQ = currentSortedQuestion();
						optionIndex = nextQ ? getFirstRecommendedIndex(nextQ.options) : 0;
						refresh();
						return true;
					}
					if (matchesKey(data, Key.left)) {
						currentTab = (currentTab - 1 + totalTabs) % totalTabs;
						const prevQ = currentSortedQuestion();
						optionIndex = prevQ ? getFirstRecommendedIndex(prevQ.options) : 0;
						refresh();
						return true;
					}
					return false;
				}

				function handleSubmitTabInput(data: string) {
					if (repromptMode) {
						repromptMode = false;
						repromptMessage = '';
						let targetTab = 0;
						for (let i = 0; i < questions.length; i++) {
							if (!answers.has(i)) {
								targetTab = i;
								break;
							}
							targetTab = i;
						}
						currentTab = targetTab;
						const prevQ = currentSortedQuestion();
						optionIndex = prevQ ? getFirstRecommendedIndex(prevQ.options) : 0;
						refresh();
						return true;
					}
					if (matchesKey(data, Key.enter) && allAnswered()) {
						submit(false);
						return true;
					}
					if (matchesKey(data, Key.escape)) {
						submit(true);
						return true;
					}
					return false;
				}

				function handleOptionNavigation(data: string) {
					const opts = currentOptions();
					if (matchesKey(data, Key.up)) {
						optionIndex = Math.max(0, optionIndex - 1);
						refresh();
						return true;
					}
					if (matchesKey(data, Key.down)) {
						optionIndex = Math.min(opts.length - 1, optionIndex + 1);
						refresh();
						return true;
					}
					return false;
				}

				// fallow-ignore-next-line complexity
				function handleOptionSelection(data: string) {
					const q = currentQuestion();
					const isMultiQ = isMultiSelect();
					if (!q) return false;

					if (matchesKey(data, Key.space) && isMultiQ) {
						toggleOption(optionIndex);
						refresh();
						return true;
					}

					if (matchesKey(data, Key.enter)) {
						const opt = currentOptions()[optionIndex];
						if (!opt) return false;
						if (opt.isOther) {
							inputMode = true;
							inputQuestionIndex = currentTab;
							noteOptionIndex = null;
							editor.setText('');
							refresh();
							return true;
						}

						if (isMultiQ) {
							const items = getSelectedItems();
							// Multi-select: require at least one option selected
							if (items.length === 0) {
								requireSelectionMode = true;
								refresh();
								return true;
							}
							saveMultiAnswer(currentTab, items);
							advanceAfterAnswer();
							return true;
						}

						// Find original index for correct answer serialization
						const q = currentQuestion();
						const originalIndex = q ? q.options.indexOf(opt) + 1 : optionIndex + 1;

						saveSingleAnswer(
							currentTab,
							opt.value,
							opt.label,
							opt.description,
							false,
							originalIndex,
						);
						advanceAfterAnswer();
						return true;
					}

					return false;
				}

				// fallow-ignore-next-line complexity
				function handleInput(data: string) {
					// Handle requireSelectionMode - dismiss warning on any key
					if (requireSelectionMode) {
						requireSelectionMode = false;
						refresh();
						return;
					}

					if (inputMode) {
						if (handleOtherInput(data)) return;
					}

					if (isMulti) {
						if (handleMultiNav(data)) return;
					}

					if (currentTab === questions.length) {
						if (handleSubmitTabInput(data)) return;
					}

					if (handleOptionNavigation(data)) return;
					if (handleOptionSelection(data)) return;

					// Handle (n) for adding note to current option in multi-select
					if (handleNoteKey(data)) return;

					if (matchesKey(data, Key.escape)) {
						submit(true);
					}
				}

				// fallow-ignore-next-line complexity
				function handleNoteKey(data: string): boolean {
					if (parseKey(data) !== 'n') return false;
					const q = currentQuestion();
					if (!q || q.type !== 'multi') return false;
					const opt = currentOptions()[optionIndex];
					if (!opt || opt.isOther || !isOptionSelected(optionIndex)) return false;
					// Get the original index for the note mapping
					const sortedQ = currentSortedQuestion();
					if (!sortedQ) return false;
					const originalOpt = sortedQ.options[optionIndex];
					if (!originalOpt) return false;
					const originalIdx = q.options.indexOf(originalOpt);
					if (originalIdx === -1) return false;
					showNotePrompt(originalIdx);
					return true;
				}

				function renderTabs(add: (s: string) => void) {
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
				}

				// fallow-ignore-next-line complexity
				function renderOptions(
					opts: RenderOption[],
					isMultiQ: boolean,
					width: number,
					add: (s: string) => void,
				) {
					const descriptionIndent = '       ';
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
							addWrappedTextWithPrefix(
								opt.description,
								width,
								descriptionIndent,
								(s) => theme.fg('muted', s),
								add,
							);
						}
					}
				}

				function renderInputMode(
					lines: string[],
					width: number,
					q: Question,
					opts: RenderOption[],
					isMultiQ: boolean,
					add: (s: string) => void,
				) {
					addWrappedText(` ${q.prompt}`, width, (s) => theme.fg('text', s), add);
					lines.push('');
					if (isMultiQ) {
						const items = getSelectedItems();
						const labels = items.map((i) => i.label);
						if (labels.length > 0) {
							add(theme.fg('muted', ` Selected: ${labels.join(', ')}`));
							lines.push('');
						}
					}
					lines.push('');
					for (const line of editor.render(width - 2)) {
						add(` ${line}`);
					}
					lines.push('');
					add(theme.fg('dim', ' Enter to submit • Esc to cancel'));
				}

				// fallow-ignore-next-line complexity
				function renderSubmitTab(lines: string[], add: (s: string) => void) {
					if (repromptMode) {
						add(theme.fg('warning', ` ⚠ ${repromptMessage}`));
						lines.push('');
						add(theme.fg('muted', ' Press any key to continue answering questions...'));
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
									const labels = multiAnswer.items.map((item) => {
										if (item.note) {
											return `${item.label} (${item.note})`;
										}
										return item.label;
									});
									const valuesStr = labels.join(', ') || '(none)';
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
				}

				function renderQuestionMode(
					lines: string[],
					width: number,
					q: Question,
					opts: RenderOption[],
					isMultiQ: boolean,
					add: (s: string) => void,
				) {
					// Show warning if user tried to advance without selection
					if (requireSelectionMode) {
						add(theme.fg('warning', ' ⚠ Please select at least one option'));
						lines.push('');
					}

					addWrappedText(` ${q.prompt}`, width, (s) => theme.fg('muted', s), add);
					lines.push('');
					renderOptions(opts, isMultiQ, width, add);
					lines.push('');
					if (isMultiQ) {
						lines.push('');
						const items = getSelectedItems();
						const labels = items.map((i) => i.label);
						if (labels.length > 0) {
							add(theme.fg('muted', ` Selected: ${labels.join(', ')}`));
						} else {
							add(theme.fg('muted', ` No options selected`));
						}
					}
				}

				function renderHelpText(
					isMulti: boolean,
					isMultiQ: boolean,
					repromptMode: boolean,
					requireSelectionMode: boolean,
					add: (s: string) => void,
				) {
					if (repromptMode) {
						add(theme.fg('warning', ' ↑↓←→ Answer a question • Esc cancel'));
					} else if (requireSelectionMode) {
						add(theme.fg('dim', ' Press any key to continue...'));
					} else {
						const help = isMulti
							? isMultiQ
								? ' ←→ navigate • ↑↓ select • Space☐ toggle • (n)ote • Enter confirm • Esc cancel'
								: ' ←→ navigate • ↑↓ select • Enter confirm • Esc cancel'
							: isMultiQ
								? ' ↑↓ select • Space☐ toggle • (n)ote • Enter confirm • Esc cancel'
								: ' ↑↓ navigate • Enter select • Esc cancel';
						add(theme.fg('dim', help));
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
						renderTabs(add);
						lines.push('');
					}

					if (inputMode && q) {
						renderInputMode(lines, width, q, opts, isMultiQ, add);
					} else if (currentTab === questions.length) {
						renderSubmitTab(lines, add);
					} else if (q) {
						renderQuestionMode(lines, width, q, opts, isMultiQ, add);
					}

					lines.push('');
					if (!inputMode) {
						renderHelpText(isMulti, isMultiQ, repromptMode, requireSelectionMode, add);
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
			const lines = formatAnswersMarkdown(questions, result);

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

		// fallow-ignore-next-line complexity
		renderResult(result, _options, theme, _context) {
			const details = result.details as QuestionnaireResult | undefined;
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === 'text' ? text.text : '', 0, 0);
			}
			if (details.cancelled) {
				return new Text(theme.fg('warning', 'Cancelled'), 0, 0);
			}

			return formatAnswersDisplay(details, theme);
		},
	});
}
