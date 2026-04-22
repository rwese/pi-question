// TypeBox schemas for the Questionnaire Tool

import { Type } from '@sinclair/typebox';

export const MultiAnswerItemSchema = Type.Object(
	{
		value: Type.String({ description: 'The option value' }),
		label: Type.String({ description: 'Display label' }),
		description: Type.Optional(Type.String({ description: 'Option description' })),
		wasCustom: Type.Boolean({ description: 'True if custom text entered' }),
		note: Type.Optional(Type.String({ description: 'User-provided note for this item' })),
	},
	{ additionalProperties: false },
);

export const QuestionOptionSchema = Type.Object(
	{
		value: Type.String({ description: 'The value returned when selected' }),
		label: Type.String({ description: 'Display label for the option' }),
		description: Type.Optional(
			Type.String({ description: 'Optional description shown below label' }),
		),
		recommended: Type.Optional(
			Type.Boolean({ description: 'Pre-select and highlight this option' }),
		),
	},
	{ additionalProperties: false },
);

export const QuestionSchema = Type.Object(
	{
		questionTopic: Type.String({
			description: "Short label for tab bar, e.g. 'Language', 'Tools'",
		}),
		prompt: Type.String({ description: 'The full question text displayed to the user' }),
		type: Type.Optional(
			Type.Union([Type.Literal('single'), Type.Literal('multi')], {
				description:
					"Question type: 'single' (radio) or 'multi' (checkbox). Default: 'single'",
			}),
		),
		options: Type.Array(QuestionOptionSchema, {
			description: 'Available options to choose from',
			minItems: 1,
		}),
	},
	{ additionalProperties: false },
);

export const QuestionnaireParams = Type.Object(
	{
		questions: Type.Array(QuestionSchema, {
			description: 'Array of question objects',
			minItems: 1,
		}),
	},
	{ additionalProperties: false },
);
