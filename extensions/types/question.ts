/**
 * Question types for the questionnaire tool.
 */

export interface QuestionOption {
	value: string;
	label: string;
	description?: string;
	recommended?: boolean;
}

export type QuestionType = 'single' | 'multi';

export interface Question {
	questionTopic: string;
	prompt: string;
	type: QuestionType;
	options: QuestionOption[];
}

// Answer types
export interface SingleAnswer {
	value: string;
	label: string;
	description?: string;
	wasCustom: boolean;
	index?: number;
	message?: string;
}

export interface MultiAnswerItem {
	value: string;
	label: string;
	description?: string;
	wasCustom: boolean;
	note?: string;
}

export interface MultiAnswer {
	items: MultiAnswerItem[];
}

export type Answer = SingleAnswer | MultiAnswer;
