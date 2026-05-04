import { describe, expect, it, vi } from "vitest";
import { Type } from "@sinclair/typebox";

// Updated schemas from extension
const QuestionOptionSchema = Type.Object(
	{
		value: Type.String({ description: "Value returned when this option is selected" }),
		label: Type.String({ description: "Display label shown to user" }),
		description: Type.Optional(
			Type.String({ description: "Optional explanation shown below the label" }),
		),
		recommended: Type.Optional(
			Type.Boolean({
				description:
					"Pre-select this option (UI hint only). Note: single-select questions can only have one recommended option",
			}),
		),
	},
	{ additionalProperties: false },
);

const QuestionSchema = Type.Object(
	{
		questionTopic: Type.String({
			description: "Short label for tab bar, e.g. 'Language', 'Tools'",
		}),
		prompt: Type.String({ description: "Question text shown to the user" }),
		type: Type.Optional(
			Type.Union([Type.Literal("single"), Type.Literal("multi")], {
				description: "'single' = radio buttons, 'multi' = checkboxes (default: single)",
			}),
		),
		options: Type.Array(QuestionOptionSchema, {
			description: "Do NOT include 'Other' - it's automatically appended for free-form input",
			minItems: 1,
		}),
	},
	{ additionalProperties: false },
);

const QuestionnaireParams = Type.Object(
	{
		questions: Type.Array(QuestionSchema, { description: "Array of question objects", minItems: 1 }),
	},
	{ additionalProperties: false }
);

// Simple validator matching TypeBox 0.34.x structure
function validateSchema(schema: Record<string, unknown>, data: unknown): { ok: boolean; errors: string[] } {
	const errors: string[] = [];

	function isOptional(schema: Record<string, unknown>): boolean {
		return "$optional" in schema;
	}

	// fallow-ignore-next-line complexity
	function check(schema: Record<string, unknown>, value: unknown, path: string) {
		const type = schema.type as string | undefined;

		if (type === "object") {
			if (typeof value !== "object" || value === null || Array.isArray(value)) {
				errors.push(`${path}: expected object`);
				return;
			}
			const obj = value as Record<string, unknown>;
			const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
			const required = schema.required as string[] | undefined;

			if (schema.additionalProperties === false && properties) {
				for (const key of Object.keys(obj)) {
					if (!(key in properties)) {
						errors.push(`${path}.${key}: additional property not allowed`);
					}
				}
			}

			if (properties) {
				for (const [propName, propSchema] of Object.entries(properties)) {
					const isRequired = !isOptional(propSchema) && (!required || required.includes(propName));

					if (!(propName in obj)) {
						if (isRequired) {
							errors.push(`${path}.${propName}: required property missing`);
						}
					} else {
						check(propSchema, obj[propName], `${path}.${propName}`);
					}
				}
			}
		} else if (type === "string") {
			if (typeof value !== "string") {
				errors.push(`${path}: expected string`);
			}
		} else if (type === "boolean") {
			if (typeof value !== "boolean") {
				errors.push(`${path}: expected boolean`);
			}
		} else if (type === "number") {
			if (typeof value !== "number") {
				errors.push(`${path}: expected number`);
			}
		} else if (type === "array") {
			if (!Array.isArray(value)) {
				errors.push(`${path}: expected array`);
				return;
			}
			const minItems = schema.minItems as number | undefined;
			if (minItems !== undefined && value.length < minItems) {
				errors.push(`${path}: array must have at least ${minItems} items`);
			}
			const items = schema.items as Record<string, unknown> | undefined;
			if (items) {
				value.forEach((item, i) => check(items, item, `${path}[${i}]`));
			}
		}
	}

	check(schema, data, "$root");
	return { ok: errors.length === 0, errors };
}

describe("QuestionOptionSchema v2", () => {
	it("accepts valid option with value and label", () => {
		const result = validateSchema(QuestionOptionSchema as unknown as Record<string, unknown>, { value: "opt1", label: "Option 1" });
		expect(result.ok).toBe(true);
	});

	it("accepts valid option with recommended", () => {
		const result = validateSchema(QuestionOptionSchema as unknown as Record<string, unknown>, { value: "opt1", label: "Option 1", recommended: true });
		expect(result.ok).toBe(true);
	});

	it("accepts valid option with optional description", () => {
		const result = validateSchema(QuestionOptionSchema as unknown as Record<string, unknown>, {
			value: "opt1",
			label: "Option 1",
			description: "This is a description",
		});
		expect(result.ok).toBe(true);
	});

	it("rejects option missing value", () => {
		const result = validateSchema(QuestionOptionSchema as unknown as Record<string, unknown>, { label: "Option 1" });
		expect(result.ok).toBe(false);
		expect(result.errors.some(e => e.includes("required property missing"))).toBe(true);
	});

	it("rejects option missing label", () => {
		const result = validateSchema(QuestionOptionSchema as unknown as Record<string, unknown>, { value: "opt1" });
		expect(result.ok).toBe(false);
		expect(result.errors.some(e => e.includes("required property missing"))).toBe(true);
	});

	it("rejects option with additional properties", () => {
		const result = validateSchema(QuestionOptionSchema as unknown as Record<string, unknown>, {
			value: "opt1",
			label: "Option 1",
			extra: "not allowed",
		});
		expect(result.ok).toBe(false);
		expect(result.errors.some(e => e.includes("additional property"))).toBe(true);
	});

	it("rejects option with non-string value", () => {
		const result = validateSchema(QuestionOptionSchema as unknown as Record<string, unknown>, { value: 123, label: "Option 1" });
		expect(result.ok).toBe(false);
		expect(result.errors).toContain("$root.value: expected string");
	});

	it("rejects option with non-boolean recommended", () => {
		const result = validateSchema(QuestionOptionSchema as unknown as Record<string, unknown>, { value: "opt1", label: "Option 1", recommended: "yes" });
		expect(result.ok).toBe(false);
		expect(result.errors.some(e => e.includes("recommended") && e.includes("expected boolean"))).toBe(true);
	});
});

describe("QuestionSchema v2", () => {
	it("accepts valid question with all fields", () => {
		const result = validateSchema(QuestionSchema as unknown as Record<string, unknown>, {
			questionTopic: "Scope",
			prompt: "What is the project scope?",
			type: "single",
			options: [{ value: "small", label: "Small" }],
		});
		expect(result.ok).toBe(true);
	});

	it("accepts valid multi-select question", () => {
		const result = validateSchema(QuestionSchema as unknown as Record<string, unknown>, {
			questionTopic: "Tools",
			prompt: "Which tools do you use?",
			type: "multi",
			options: [{ value: "git", label: "Git" }, { value: "docker", label: "Docker" }],
		});
		expect(result.ok).toBe(true);
	});

	it("accepts question with recommended options", () => {
		const result = validateSchema(QuestionSchema as unknown as Record<string, unknown>, {
			questionTopic: "Language",
			prompt: "Choose a language",
			type: "multi",
			options: [
				{ value: "go", label: "Go", recommended: true },
				{ value: "rust", label: "Rust" },
				{ value: "typescript", label: "TypeScript", recommended: true },
			],
		});
		expect(result.ok).toBe(true);
	});

	it("rejects question missing questionTopic", () => {
		const result = validateSchema(QuestionSchema as unknown as Record<string, unknown>, {
			prompt: "What is the project scope?",
			options: [{ value: "small", label: "Small" }],
		});
		expect(result.ok).toBe(false);
	});

	it("rejects question missing prompt", () => {
		const result = validateSchema(QuestionSchema as unknown as Record<string, unknown>, {
			questionTopic: "Scope",
			options: [{ value: "small", label: "Small" }],
		});
		expect(result.ok).toBe(false);
	});

	it("rejects question with empty options", () => {
		const result = validateSchema(QuestionSchema as unknown as Record<string, unknown>, {
			questionTopic: "Scope",
			prompt: "What is the project scope?",
			options: [],
		});
		expect(result.ok).toBe(false);
	});

	it("accepts valid type values", () => {
		const result1 = validateSchema(QuestionSchema as unknown as Record<string, unknown>, {
			questionTopic: "Test",
			prompt: "Test?",
			type: "single",
			options: [{ value: "a", label: "A" }],
		});
		expect(result1.ok).toBe(true);

		const result2 = validateSchema(QuestionSchema as unknown as Record<string, unknown>, {
			questionTopic: "Test",
			prompt: "Test?",
			type: "multi",
			options: [{ value: "a", label: "A" }],
		});
		expect(result2.ok).toBe(true);
	});

	it("accepts question without type (defaults to single)", () => {
		const result = validateSchema(QuestionSchema as unknown as Record<string, unknown>, {
			questionTopic: "Test",
			prompt: "Test?",
			options: [{ value: "a", label: "A" }],
		});
		expect(result.ok).toBe(true);
	});
});

describe("QuestionnaireParams v2", () => {
	it("accepts single question questionnaire", () => {
		const result = validateSchema(QuestionnaireParams as unknown as Record<string, unknown>, {
			questions: [
				{
					questionTopic: "Preference",
					prompt: "What is your preference?",
					options: [{ value: "a", label: "Option A" }],
				},
			],
		});
		expect(result.ok).toBe(true);
	});

	it("accepts multi-question questionnaire with mixed types", () => {
		const result = validateSchema(QuestionnaireParams as unknown as Record<string, unknown>, {
			questions: [
				{
					questionTopic: "Scope",
					type: "single",
					prompt: "What is the project scope?",
					options: [{ value: "small", label: "Small" }, { value: "large", label: "Large" }],
				},
				{
					questionTopic: "Tools",
					type: "multi",
					prompt: "Which tools do you use?",
					options: [{ value: "git", label: "Git" }, { value: "docker", label: "Docker" }],
				},
			],
		});
		expect(result.ok).toBe(true);
	});

	it("rejects missing questions field", () => {
		const result = validateSchema(QuestionnaireParams as unknown as Record<string, unknown>, {});
		expect(result.ok).toBe(false);
	});

	it("accepts question with multiple options", () => {
		const result = validateSchema(QuestionnaireParams as unknown as Record<string, unknown>, {
			questions: [
				{
					questionTopic: "Color",
					prompt: "Choose a color",
					options: [
						{ value: "red", label: "Red" },
						{ value: "green", label: "Green" },
						{ value: "blue", label: "Blue" },
						{ value: "yellow", label: "Yellow" },
					],
				},
			],
		});
		expect(result.ok).toBe(true);
	});

	it("accepts multi-select with multiple recommended", () => {
		const result = validateSchema(QuestionnaireParams as unknown as Record<string, unknown>, {
			questions: [
				{
					questionTopic: "Select",
					type: "multi",
					prompt: "Select all that apply",
					options: [
						{ value: "a", label: "A", recommended: true },
						{ value: "b", label: "B", recommended: true },
						{ value: "c", label: "C" },
					],
				},
			],
		});
		expect(result.ok).toBe(true);
	});
});
