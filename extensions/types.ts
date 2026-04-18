// Types for the Questionnaire Tool

export interface QuestionOption {
	value: string;
	label: string;
	description?: string;
	recommended?: boolean;
}

export type RenderOption = QuestionOption & { isOther?: boolean };

export type QuestionType = 'single' | 'multi';

export interface Question {
	questionTopic: string;
	prompt: string;
	type: QuestionType;
	options: QuestionOption[];
}

export interface SingleAnswer {
	value: string;
	label: string;
	wasCustom: boolean;
	index?: number;
	message?: string;
}

export interface MultiAnswer {
	values: string[];
	labels: string[];
	wasCustom: boolean[];
}

export type Answer = SingleAnswer | MultiAnswer;

export interface QuestionnaireResult {
	questions: Question[];
	answers: Answer[];
	cancelled: boolean;
}

export interface PendingOther {
	index: number;
	appended: boolean;
}

export interface QuestionnaireError {
	code: 'MULTIPLE_RECOMMENDED' | 'INVALID_TYPE' | 'EMPTY_OPTIONS';
	message: string;
	questionIndex?: number;
	recommendedCount?: number;
}

// Constants
export const OTHER_VALUE = '__other__';
export const OTHER_LABEL = 'Other';
export const NO_CHOICE = '(no choice)';
export const OTHER_INPUT = '(other)';
