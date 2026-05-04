/**
 * Result and error types for the questionnaire tool.
 */

import type { Answer, Question } from './question';

export interface QuestionnaireResult {
	questions: Question[];
	answers: Answer[];
	cancelled: boolean;
}

export type QuestionnaireErrorCode = 'MULTIPLE_RECOMMENDED' | 'INVALID_TYPE' | 'EMPTY_OPTIONS';

export interface QuestionnaireError {
	code: QuestionnaireErrorCode;
	message: string;
	questionIndex?: number;
	recommendedCount?: number;
}

export interface ErrorResult {
	content: { type: 'text'; text: string }[];
	details: QuestionnaireResult;
	error: QuestionnaireError;
}

export interface ValidationResult {
	ok: boolean;
	errors: string[];
}

export function createErrorResult(message: string, error: QuestionnaireError): ErrorResult {
	return {
		content: [{ type: 'text', text: message }],
		details: { questions: [], answers: [], cancelled: true },
		error,
	};
}

export function createValidationError(
	message: string,
	questions: Question[] = [],
): { content: { type: 'text'; text: string }[]; details: QuestionnaireResult } {
	return {
		content: [{ type: 'text', text: message }],
		details: { questions, answers: [], cancelled: true },
	};
}
