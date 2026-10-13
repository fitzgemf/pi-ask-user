// Pi / Oh My Pi extension entry point: registers the model-callable `ask_user` tool.
// The parameters are a plain JSON Schema so the extension has no runtime dependencies.

import { askUser, formatResult, type AskUserParams } from "./core.ts";

export const askUserParameters = {
	type: "object",
	properties: {
		question: {
			type: "string",
			description: "The single, specific question to ask the human.",
		},
		options: {
			type: "array",
			items: { type: "string" },
			description: "Suggested answers shown as a pick list (2-6 short labels). Omit for a free-text question.",
		},
		allowCustom: {
			type: "boolean",
			description: "Let the user type their own answer in addition to the options. Default true.",
		},
		context: {
			type: "string",
			description: "Optional one-line explanation of why the answer matters.",
		},
	},
	required: ["question"],
	additionalProperties: false,
} as const;

export const askUserTool = {
	name: "ask_user",
	label: "Ask User",
	description:
		"Ask the human user a question and wait for their answer. Use this when you reach an important decision " +
		"that you cannot resolve from the request or the code (e.g. design choices, preferences, ambiguous " +
		"requirements). Provide the question and, when possible, a short list of options; the user may also type " +
		"a custom answer. The tool returns the user's answer, or states clearly that no answer was given.",
	parameters: askUserParameters,
	// OMP: expose as a top-level tool instead of a deferred "discoverable" one. Upstream Pi ignores this field.
	loadMode: "essential" as const,
	async execute(_toolCallId: string, params: AskUserParams, signal?: AbortSignal, _onUpdate?: unknown, ctx?: any) {
		const result = await askUser(params, {
			hasUI: ctx?.hasUI === true && ctx?.ui != null,
			ui: ctx?.ui,
			signal,
		});
		return {
			content: [{ type: "text" as const, text: formatResult(result) }],
			details: result,
			isError: result.status === "invalid",
		};
	},
};

export default function askUserExtension(pi: { registerTool(tool: unknown): void }) {
	pi.registerTool(askUserTool);
}
