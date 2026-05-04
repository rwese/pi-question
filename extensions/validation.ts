/**
 * Validation logic for questionnaire questions.
 */

import type { Question, QuestionnaireError, QuestionnaireErrorCode } from './types/index.js';

export interface ValidationError {
	code: QuestionnaireErrorCode;
	message: string;
	questionIndex?: number;
	recommendedCount?: number;
}

/**
 * Validates a single question.
 */
export function validateQuestion(q: Question, index: number): ValidationError | null {
	// Validate single-select has at most 1 recommended
	if (q.type === 'single') {
		const recommendedCount = q.options.filter((o) => o.recommended).length;
		if (recommendedCount > 1) {
			return {
				code: 'MULTIPLE_RECOMMENDED',
				message: `Single-select question ${index + 1} has ${recommendedCount} recommended options, expected at most 1`,
				questionIndex: index,
				recommendedCount,
			};
		}
	}
	return null;
}

/**
 * Validates all questions and returns the first error found.
 */
export function validateQuestions(questions: Question[]): ValidationError | null {
	for (let i = 0; i < questions.length; i++) {
		const q = questions[i];
		if (!q) continue;
		const error = validateQuestion(q, i);
		if (error) {
			return error;
		}
	}
	return null;
}

/**
 * Creates a QuestionnaireError object from a ValidationError.
 */
export function toQuestionnaireError(error: ValidationError): QuestionnaireError {
	return {
		code: error.code,
		message: error.message,
		questionIndex: error.questionIndex,
		recommendedCount: error.recommendedCount,
	};
}
