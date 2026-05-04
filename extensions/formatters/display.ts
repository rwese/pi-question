/**
 * Display formatter for questionnaire answers.
 * Formats answers for TUI display in renderResult().
 */

import type { QuestionnaireResult } from '../types/index.js';
import { Text } from '@mariozechner/pi-tui';

/**
 * Format answers for display in the tool result.
 * Used in renderResult() to show the formatted answers.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatAnswersDisplay(result: QuestionnaireResult, theme: any): Text {
	if (result.cancelled) {
		return new Text(theme.fg('warning', 'Cancelled'), 0, 0);
	}

	const lines: string[] = [];
	lines.push('## User answered our questions');
	lines.push('');

	for (let i = 0; i < result.questions.length; i++) {
		const q = result.questions[i];
		if (!q) continue;
		const answer = result.answers[i];
		if (!answer) continue;

		lines.push(`## Question - ${q.questionTopic}`);
		lines.push('');
		lines.push(q.prompt);
		lines.push('');
		lines.push('### Answer');
		lines.push('');
		lines.push(...formatAnswerDisplay(q, answer));
		lines.push('');
	}

	return new Text(lines.join('\n'), 0, 0);
}

/**
 * Format a single answer for display.
 */
// fallow-ignore-next-line complexity
function formatAnswerDisplay(
	q: QuestionnaireResult['questions'][number],
	answer: QuestionnaireResult['answers'][number],
): string[] {
	const lines: string[] = [];

	if (q.type === 'multi' && 'items' in answer) {
		const multiAnswer = answer as QuestionnaireResult['answers'][number] & { items: unknown[] };
		if (multiAnswer.items.length === 0) {
			lines.push(`- (no selection)`);
		} else {
			for (const item of multiAnswer.items as Array<{
				label: string;
				description?: string;
				note?: string;
			}>) {
				if (item.description) {
					lines.push(`- [x] **${item.label}** - ${item.description}`);
				} else {
					lines.push(`- [x] ${item.label}`);
				}
				if (item.note) {
					lines.push(`  Note: ${item.note}`);
				}
			}
		}
	} else {
		const singleAnswer = answer as { label: string; description?: string; message?: string };
		if (singleAnswer.description) {
			lines.push(`- **${singleAnswer.label}** - ${singleAnswer.description}`);
		} else {
			lines.push(`- ${singleAnswer.label}`);
		}
		if (singleAnswer.message) {
			lines.push(`  Note: "${singleAnswer.message}"`);
		}
	}

	return lines;
}
