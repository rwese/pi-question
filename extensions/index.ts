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

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	Editor,
	type EditorTheme,
	Key,
	matchesKey,
	Text,
	truncateToWidth,
} from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

// Types
interface QuestionOption {
	value: string;
	label: string;
	description?: string;
	recommended?: boolean;
}

type RenderOption = QuestionOption & { isOther?: boolean };

type QuestionType = "single" | "multi";

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
	message?: string;
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
	code: "MULTIPLE_RECOMMENDED" | "INVALID_TYPE" | "EMPTY_OPTIONS";
	message: string;
	questionIndex?: number;
	recommendedCount?: number;
}

// Constants
const OTHER_VALUE = "__other__";
const OTHER_LABEL = "Other";
const NO_CHOICE = "(no choice)";
const OTHER_INPUT = "(other)";

// Schema
const QuestionOptionSchema = Type.Object(
	{
		value: Type.String({ description: "The value returned when selected" }),
		label: Type.String({ description: "Display label for the option" }),
		description: Type.Optional(
			Type.String({ description: "Optional description shown below label" }),
		),
		recommended: Type.Optional(
			Type.Boolean({ description: "Pre-select and highlight this option" }),
		),
	},
	{ additionalProperties: false },
);

const QuestionSchema = Type.Object(
	{
		questionTopic: Type.String({
			description: "Short label for tab bar, e.g. 'Language', 'Tools'",
		}),
		prompt: Type.String({ description: "The full question text displayed to the user" }),
		type: Type.Optional(
			Type.Union([Type.Literal("single"), Type.Literal("multi")], {
				description: "Question type: 'single' (radio) or 'multi' (checkbox). Default: 'single'",
			}),
		),
		options: Type.Array(QuestionOptionSchema, {
			description: "Available options to choose from",
			minItems: 1,
		}),
	},
	{ additionalProperties: false },
);

const QuestionnaireParams = Type.Object(
	{
		questions: Type.Array(QuestionSchema, {
			description: "Array of question objects",
			minItems: 1,
		}),
	},
	{ additionalProperties: false },
);

function errorResult(
	message: string,
	error: QuestionnaireError,
): { content: { type: "text"; text: string }[]; details: QuestionnaireResult; error: QuestionnaireError } {
	return {
		content: [{ type: "text", text: message }],
		details: { questions: [], answers: [], cancelled: true },
		error,
	};
}

function validationError(
	message: string,
	questions: Question[] = [],
): { content: { type: "text"; text: string }[]; details: QuestionnaireResult } {
	return {
		content: [{ type: "text", text: message }],
		details: { questions, answers: [], cancelled: true },
	};
}

export default function question(pi: ExtensionAPI) {
	pi.registerTool({
		name: "question",
		label: "Question",
		description:
			"Collect user decisions through questions. Use when: gathering preferences, confirming configurations, clarifying ambiguous interpretations. Features: single/multiple choice, recommended defaults. Output: markdown.",
		parameters: QuestionnaireParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (!ctx.hasUI) {
				return validationError(
					"Error: UI not available (running in non-interactive mode)",
					[],
				);
			}
			if (!params.questions || params.questions.length === 0) {
				return validationError("Error: No questions provided", []);
			}

			// Normalize questions with defaults
			const questions: Question[] = params.questions.map((q) => ({
				questionTopic: q.questionTopic,
				prompt: q.prompt,
				type: q.type || "single",
				options: q.options,
			}));

			// Validate: single-select with multiple recommended = error
			for (let i = 0; i < questions.length; i++) {
				const q = questions[i];
				if (!q) continue;
				if (q.type === "single") {
					const recommendedCount = q.options.filter((o) => o.recommended).length;
					if (recommendedCount > 1) {
						return errorResult(
							`Error: Question ${i + 1} is single-select but has ${recommendedCount} recommended options`,
							{
								code: "MULTIPLE_RECOMMENDED",
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

				// For multi-select: track which options are selected
				const selectedOptions = new Map<number, Set<number>>();

				// Initialize selected options with recommended
				for (let i = 0; i < questions.length; i++) {
					const q = questions[i];
					if (!q) continue;
					if (q.type === "multi") {
						const selected = new Set<number>();
						q.options.forEach((opt, idx) => {
							if (opt.recommended) {
								selected.add(idx);
							}
						});
						selectedOptions.set(i, selected);
					}
				}

				// Editor for "Other" option and messages
				const editorTheme: EditorTheme = {
					borderColor: (s) => theme.fg("accent", s),
					selectList: {
						selectedPrefix: (t) => theme.fg("accent", t),
						selectedText: (t) => theme.fg("accent", t),
						description: (t) => theme.fg("muted", t),
						scrollInfo: (t) => theme.fg("dim", t),
						noMatch: (t) => theme.fg("warning", t),
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
					const q = currentQuestion();
					if (!q) return [];
					// Filter out any existing Other to prevent duplication
					const filteredOptions = q.options.filter((opt) => opt.value !== OTHER_VALUE);
					const opts: RenderOption[] = [...filteredOptions];
					// Other always available
					opts.push({ value: OTHER_VALUE, label: OTHER_LABEL, isOther: true });
					return opts;
				}

				function allAnswered(): boolean {
					for (let i = 0; i < questions.length; i++) {
						if (!answers.has(i)) return false;
					}
					return true;
				}

				function isMultiSelect(): boolean {
					const q = currentQuestion();
					return q?.type === "multi";
				}

				function isOptionSelected(idx: number): boolean {
					const q = currentQuestion();
					if (!q) return false;
					if (q.type === "multi") {
						return selectedOptions.get(currentTab)?.has(idx) ?? false;
					}
					return optionIndex === idx;
				}

				function toggleOption(idx: number) {
					const q = currentQuestion();
					if (!q || q.type !== "multi") return;
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
					optionIndex = 0;
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
					message?: string,
				) {
					const answer: MultiAnswer = {
						values,
						labels,
						wasCustom,
						message,
					};
					answers.set(questionIndex, answer);
				}

				function getSelectedValues(): { values: string[]; labels: string[]; wasCustom: boolean[] } {
					const q = currentQuestion();
					if (!q || q.type !== "multi") {
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
					editor.setText("");
					refresh();
				}

				function submitPendingWithMessage(msg: string) {
					if (!pendingOther) return;
					const trimmedMsg = msg.trim();
					const q = questions[pendingOther.index];
					if (!q) return;

					if (q.type === "multi") {
						const { values, labels, wasCustom } = getSelectedValues();
						if (pendingOther.appended) {
							if (trimmedMsg) {
								values.push(OTHER_INPUT);
								labels.push(trimmedMsg);
								wasCustom.push(true);
							}
						}
						saveMultiAnswer(
							pendingOther.index,
							values,
							labels,
							wasCustom,
							trimmedMsg || undefined,
						);
					} else {
						if (trimmedMsg) {
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
								"(no choice)",
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

					if (q.type === "multi") {
						const { values, labels, wasCustom } = getSelectedValues();
						if (pendingOther.appended) {
							if (values.length === 0) {
								values.push(NO_CHOICE);
								labels.push("(no choice)");
								wasCustom.push(false);
							}
						}
						saveMultiAnswer(pendingOther.index, values, labels, wasCustom, undefined);
					} else {
						saveSingleAnswer(
							pendingOther.index,
							NO_CHOICE,
							"(no choice)",
							false,
							undefined,
							undefined,
						);
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

					if (q.type === "multi") {
						const { values, labels, wasCustom } = getSelectedValues();
						values.push(OTHER_INPUT);
						labels.push(trimmed);
						wasCustom.push(true);
						saveMultiAnswer(inputQuestionIndex, values, labels, wasCustom, undefined);
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
					editor.setText("");
					advanceAfterAnswer();
				};

				function handleInput(data: string) {
					if (messageMode) {
						if (matchesKey(data, Key.escape)) {
							pendingOther = null;
							messageMode = false;
							editor.setText("");
							refresh();
							return;
						}
						if (matchesKey(data, Key.tab)) {
							skipMessageAndSubmit();
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
							editor.setText("");
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
							currentTab = (currentTab + 1) % totalTabs;
							optionIndex = 0;
							refresh();
							return;
						}
						if (matchesKey(data, Key.left)) {
							currentTab = (currentTab - 1 + totalTabs) % totalTabs;
							optionIndex = 0;
							refresh();
							return;
						}
					}

					if (currentTab === questions.length) {
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
						const opt = opts[optionIndex];
						if (!opt) return;
						if (opt.isOther) {
							inputMode = true;
							inputQuestionIndex = currentTab;
							editor.setText("");
							refresh();
							return;
						}

						if (isMultiQ) {
							const { values, labels, wasCustom } = getSelectedValues();
							if (values.length === 0) {
								values.push(NO_CHOICE);
								labels.push("(no choice)");
								wasCustom.push(false);
							}
							saveMultiAnswer(currentTab, values, labels, wasCustom, undefined);
							advanceAfterAnswer();
							return;
						}

						saveSingleAnswer(
							currentTab,
							opt.value,
							opt.label,
							false,
							optionIndex + 1,
						);
						advanceAfterAnswer();
						return;
					}

					if (matchesKey(data, Key.tab) && q) {
						const opt = opts[optionIndex];
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

					add(theme.fg("accent", "─".repeat(width)));

					if (isMulti) {
						const tabs: string[] = ["← "];
						for (let i = 0; i < questions.length; i++) {
							const qAtIdx = questions[i];
							if (!qAtIdx) continue;
							const isActive = i === currentTab;
							const isAnswered = answers.has(i);
							const box = isAnswered ? "■" : "□";
							const color = isAnswered ? "success" : "muted";
							const text = ` ${box} ${qAtIdx.questionTopic} `;
							const styled = isActive
								? theme.bg("selectedBg", theme.fg("text", text))
								: theme.fg(color, text);
							tabs.push(`${styled} `);
						}
						const canSubmit = allAnswered();
						const isSubmitTab = currentTab === questions.length;
						const submitText = " ✓ Submit ";
						const submitStyled = isSubmitTab
							? theme.bg("selectedBg", theme.fg("text", submitText))
							: theme.fg(canSubmit ? "success" : "dim", submitText);
						tabs.push(`${submitStyled} →`);
						add(` ${tabs.join("")}`);
						lines.push("");
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
								const cursorMark = isCursor ? theme.fg("accent", ">") + " " : "  ";
								const checkMark = selected ? theme.fg("accent", "☑") : theme.fg("muted", "☐");
								prefix = cursorMark + checkMark + " ";
							} else {
								prefix = isCursor ? theme.fg("accent", "> ● ") : theme.fg("muted", "  ○ ");
							}

							const selectedColor = selected ? "accent" : "text";
							let labelText = `${i + 1}. ${opt.label}`;

							if (isRecommended) {
								labelText += ` ${theme.fg("success", "(Recommended)")}`;
							}

							if (isOther && inputMode) {
								add(prefix + theme.fg("accent", labelText + " ✎"));
							} else {
								add(prefix + theme.fg(selectedColor, labelText));
							}
							if (opt.description) {
								add(`       ${theme.fg("muted", opt.description)}`);
							}
						}
					}

					if (inputMode && q) {
						add(theme.fg("text", ` ${q.prompt}`));
						lines.push("");
						if (isMultiQ) {
							const { labels } = getSelectedValues();
							if (labels.length > 0) {
								add(theme.fg("muted", ` Selected: ${labels.join(", ")}`));
								lines.push("");
							}
						}
						renderOptions();
						lines.push("");
						add(theme.fg("muted", " Your answer:"));
						for (const line of editor.render(width - 2)) {
							add(` ${line}`);
						}
						lines.push("");
						add(theme.fg("dim", " Enter to submit • Esc to cancel"));
					} else if (messageMode && q) {
						add(theme.fg("text", ` ${q.prompt}`));
						lines.push("");

						if (isMultiQ) {
							const { labels } = getSelectedValues();
							if (labels.length > 0) {
								add(theme.fg("muted", ` Selected: `) + theme.fg("accent", labels.join(", ")));
							} else {
								add(theme.fg("muted", ` No options selected`));
							}
						} else {
							const selectedOpt = opts[optionIndex];
							add(theme.fg("muted", ` Selected: `) + theme.fg("accent", selectedOpt?.label || ""));
						}
						lines.push("");
						add(theme.fg("muted", " Add note (optional):"));
						for (const line of editor.render(width - 2)) {
							add(` ${line}`);
						}
						lines.push("");
						add(theme.fg("dim", " Enter save • Tab skip • Esc back"));
					} else if (currentTab === questions.length) {
						add(theme.fg("accent", theme.bold(" Ready to submit")));
						lines.push("");
							for (let i = 0; i < questions.length; i++) {
								const question = questions[i];
								if (!question) continue;
								const answer = answers.get(i);
								if (answer) {
									if (question.type === "multi") {
									const multiAnswer = answer as MultiAnswer;
									const valuesStr = multiAnswer.labels.join(", ") || "(none)";
									add(`${theme.fg("muted", ` ${question.questionTopic}: `)}${theme.fg("text", valuesStr)}`);
									if (multiAnswer.message) {
										add(`     ${theme.fg("muted", `Note: "${multiAnswer.message}"`)}`);
									}
								} else {
									const singleAnswer = answer as SingleAnswer;
									const prefix = singleAnswer.wasCustom ? "(custom) " : "";
									add(`${theme.fg("muted", ` ${question.questionTopic}: `)}${theme.fg("text", prefix + singleAnswer.label)}`);
									if (singleAnswer.message) {
										add(`     ${theme.fg("muted", `Note: "${singleAnswer.message}"`)}`);
									}
								}
							}
						}
						lines.push("");
						if (allAnswered()) {
							add(theme.fg("success", " Press Enter to submit"));
						} else {
							const missing = questions
								.filter((_, i) => !answers.has(i))
								.map((qq) => qq.questionTopic)
								.join(", ");
							add(theme.fg("warning", ` Unanswered: ${missing}`));
						}
					} else if (q) {
						add(theme.fg("muted", ` ${q.prompt}`));
						lines.push("");
						renderOptions();
					}

					lines.push("");
					if (!inputMode && !messageMode) {
						const help = isMulti
							? isMultiQ
								? " ←→ navigate • ↑↓ select • Space☐ toggle • Tab↹ add note • Enter confirm • Esc cancel"
								: " ←→ navigate • ↑↓ select • Tab↹ add note • Enter confirm • Esc cancel"
							: isMultiQ
								? " ↑↓ select • Space☐ toggle • Tab↹ add note • Enter confirm • Esc cancel"
								: " ↑↓ navigate • Enter select • Tab↹ add note • Esc cancel";
						add(theme.fg("dim", help));
					}
					add(theme.fg("accent", "─".repeat(width)));

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
				return {
					content: [{ type: "text", text: "User cancelled the question" }],
					details: result,
				};
			}

			// Format answers as markdown sections
			const lines: string[] = [];
			for (let i = 0; i < questions.length; i++) {
				const q = questions[i];
				if (!q) continue;
				const answer = result.answers[i];

				if (!answer) continue;

				lines.push(`### ${q.prompt}`);
				lines.push("");

				if (q.type === "multi") {
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
				}

				lines.push("");
			}

			return {
				content: [{ type: "text", text: lines.join("\n") }],
				details: result,
			};
		},

		renderCall(args, theme, _context) {
			const qs = (args.questions as Question[]) || [];
			const count = qs.length;
			const topics = qs.map((q) => q.questionTopic).join(", ");
			let text = theme.fg("toolTitle", theme.bold("question "));
			text += theme.fg("muted", `${count} question${count !== 1 ? "s" : ""}`);
			if (topics) {
				text += theme.fg("dim", ` (${truncateToWidth(topics, 40)})`);
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, _options, theme, _context) {
			const details = result.details as QuestionnaireResult | undefined;
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}
			if (details.cancelled) {
				return new Text(theme.fg("warning", "Cancelled"), 0, 0);
			}

			const lines: string[] = [];
			for (let i = 0; i < details.questions.length; i++) {
				const q = details.questions[i];
				if (!q) continue;
				const answer = details.answers[i];
				if (!answer) continue;

				lines.push(`### ${q.prompt}`);
				lines.push("");

				if (q.type === "multi") {
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
				}

				lines.push("");
			}

			return new Text(lines.join("\n"), 0, 0);
		},
	});
}
