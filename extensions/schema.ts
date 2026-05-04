/**
 * Schema definitions using TypeBox for runtime validation.
 */

import { Type } from '@sinclair/typebox';

export const QuestionOptionSchema = Type.Object(
	{
		value: Type.String({
			description:
				"Value for this option. Use lowercase, hyphenated (e.g., 'cake'). This appears in the answer.",
		}),
		label: Type.String({
			description: "Display text shown to the user (e.g., 'Yes, cake is the best!').",
		}),
		description: Type.Optional(
			Type.String({
				description:
					"Optional secondary descriptive text shown below the label to provide context. (e.g., 'Because it reminds me of my birthday')",
			}),
		),
		recommended: Type.Optional(
			Type.Boolean({
				description: 'If true, highlights and pre-selects this option.',
			}),
		),
	},
	{ additionalProperties: false },
);

export const QuestionSchema = Type.Object(
	{
		questionTopic: Type.String({
			description:
				"Short identifier, used for tab label (e.g., 'deploy-confirm'). Not shown to the user.",
		}),
		prompt: Type.String({
			description:
				'The question to display. Be specific and concise. End with a question mark.',
		}),
		type: Type.Optional(
			Type.Union([Type.Literal('single'), Type.Literal('multi')], {
				description: "'single' allows one answer. 'multi' allows multiple answers.",
			}),
		),
		options: Type.Array(QuestionOptionSchema, {
			minItems: 1,
			description: 'Available choices for the user. Must have at least 1 option.',
		}),
	},
	{ additionalProperties: false },
);

export const QuestionnaireParamsSchema = Type.Object(
	{
		questions: Type.Array(QuestionSchema, {
			minItems: 1,
			description: 'Array of questions to ask.',
		}),
	},
	{ additionalProperties: false },
);
