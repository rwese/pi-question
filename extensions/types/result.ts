/**
 * Result and error types for the questionnaire tool.
 */

import type { Answer, Question } from './question';

export interface QuestionnaireResult {
	questions: Question[];
	answers: Answer[];
	cancelled: boolean;
}

// fallow-ignore-next-line unused-type
export type QuestionnaireErrorCode = 'MULTIPLE_RECOMMENDED' | 'INVALID_TYPE' | 'EMPTY_OPTIONS';

export interface QuestionnaireError {
	code: QuestionnaireErrorCode;
	message: string;
	questionIndex?: number;
	recommendedCount?: number;
}

// fallow-ignore-next-line unused-type
export interface ErrorResult {
	content: { type: 'text'; text: string }[];
	details: QuestionnaireResult;
	error: QuestionnaireError;
}

// fallow-ignore-next-line unused-type
export interface ValidationResult {
	ok: boolean;
	errors: string[];
}

// fallow-ignore-next-line unused-export
export function createErrorResult(message: string, error: QuestionnaireError): ErrorResult {
	return {
		content: [{ type: 'text', text: message }],
		details: { questions: [], answers: [], cancelled: true },
		error,
	};
}

// fallow-ignore-next-line unused-export
export function createValidationError(
	message: string,
	questions: Question[] = [],
): { content: { type: 'text'; text: string }[]; details: QuestionnaireResult } {
	return {
		content: [{ type: 'text', text: message }],
		details: { questions, answers: [], cancelled: true },
	};
}
