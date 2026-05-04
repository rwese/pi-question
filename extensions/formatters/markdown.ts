/**
 * Markdown formatter for questionnaire answers.
 * Formats answers into markdown sections for agent context.
 */

import type { MultiAnswer, Question, QuestionnaireResult, SingleAnswer } from '../types/index.js';

/**
 * Format answers as markdown sections.
 * Used in execute() after user completes the questionnaire.
 */
export function formatAnswersMarkdown(
	questions: Question[],
	result: QuestionnaireResult,
): string[] {
	const lines: string[] = [];
	lines.push('## User answered our questions');
	lines.push('');

	for (let i = 0; i < questions.length; i++) {
		const q = questions[i];
		if (!q) continue;
		const answer = result.answers[i];
		if (!answer) continue;

		lines.push(`## Question - ${q.questionTopic}`);
		lines.push('');
		lines.push(q.prompt);
		lines.push('');
		lines.push('### Answer');
		lines.push('');
		lines.push(...formatAnswerMarkdown(q, answer));
		lines.push('');
	}

	return lines;
}

/**
 * Format a single answer as markdown lines.
 */
// fallow-ignore-next-line complexity
function formatAnswerMarkdown(
	q: Question,
	answer: QuestionnaireResult['answers'][number],
): string[] {
	const lines: string[] = [];

	if (q.type === 'multi' && 'items' in answer && Array.isArray(answer.items)) {
		const multiAnswer = answer as MultiAnswer;
		if (multiAnswer.items.length === 0) {
			lines.push(`- (no selection)`);
		} else {
			for (const item of multiAnswer.items) {
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
		const singleAnswer = answer as SingleAnswer;
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
