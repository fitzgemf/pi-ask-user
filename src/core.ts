// Pure, UI-agnostic logic for the ask_user tool. No Pi imports, so it can be
// unit-tested with a fake UI under plain `node --test`.

export const CUSTOM_ANSWER_LABEL = "✎ Type a custom answer…";

export interface AskUserParams {
	question: string;
	options?: string[];
	allowCustom?: boolean;
	context?: string;
}

/** The subset of Pi's ExtensionUIContext that ask_user needs. */
export interface AskUserUI {
	select(title: string, options: string[], opts?: { signal?: AbortSignal }): Promise<string | undefined>;
	input(title: string, placeholder?: string, opts?: { signal?: AbortSignal }): Promise<string | undefined>;
}

export interface AskUserEnv {
	hasUI: boolean;
	ui?: AskUserUI;
	signal?: AbortSignal;
}

export type AskUserResult =
	| { status: "answered"; question: string; answer: string; source: "option" | "custom"; optionIndex?: number }
	| { status: "cancelled"; question: string; reason: string }
	| { status: "unavailable"; question: string; reason: string }
	| { status: "invalid"; question: string; reason: string };

function cleanOptions(options: unknown): string[] {
	if (!Array.isArray(options)) return [];
	const seen = new Set<string>();
	const out: string[] = [];
	for (const o of options) {
		if (typeof o !== "string") continue;
		const t = o.trim();
		if (t && t !== CUSTOM_ANSWER_LABEL && !seen.has(t)) {
			seen.add(t);
			out.push(t);
		}
	}
	return out;
}

export async function askUser(params: AskUserParams, env: AskUserEnv): Promise<AskUserResult> {
	const question = typeof params?.question === "string" ? params.question.trim() : "";
	if (!question) {
		return { status: "invalid", question: "", reason: "The 'question' parameter must be a non-empty string." };
	}
	if (!env.hasUI || !env.ui) {
		return {
			status: "unavailable",
			question,
			reason: "No interactive UI is available (e.g. print/JSON/headless mode), so the user cannot be asked.",
		};
	}
	if (env.signal?.aborted) {
		return { status: "cancelled", question, reason: "The request was aborted before the user answered." };
	}

	const options = cleanOptions(params.options);
	const allowCustom = params.allowCustom !== false || options.length === 0;
	const title = params.context?.trim() ? `${question}\n\n${params.context.trim()}` : question;
	const opts = { signal: env.signal };

	try {
		let custom = options.length === 0;
		if (!custom) {
			const choices = allowCustom ? [...options, CUSTOM_ANSWER_LABEL] : options;
			const picked = await env.ui.select(title, choices, opts);
			if (picked === undefined || env.signal?.aborted) {
				return { status: "cancelled", question, reason: "The user dismissed the question without choosing." };
			}
			if (picked === CUSTOM_ANSWER_LABEL && allowCustom) {
				custom = true;
			} else {
				const optionIndex = options.indexOf(picked);
				if (optionIndex === -1) {
					return { status: "cancelled", question, reason: "The selection did not match any offered option." };
				}
				return { status: "answered", question, answer: picked, source: "option", optionIndex };
			}
		}

		const typed = await env.ui.input(title, "Type your answer", opts);
		const answer = typeof typed === "string" ? typed.trim() : "";
		if (env.signal?.aborted) {
			return { status: "cancelled", question, reason: "The request was aborted before the user answered." };
		}
		if (!answer) {
			return {
				status: "cancelled",
				question,
				reason: typed === undefined ? "The user dismissed the input." : "The user submitted an empty answer.",
			};
		}
		return { status: "answered", question, answer, source: "custom" };
	} catch (err) {
		if (env.signal?.aborted) {
			return { status: "cancelled", question, reason: "The request was aborted before the user answered." };
		}
		const msg = err instanceof Error ? err.message : String(err);
		return { status: "unavailable", question, reason: `The interactive UI failed: ${msg}` };
	}
}

/** Text returned to the model. It must be unambiguous about whether a real answer exists. */
export function formatResult(r: AskUserResult): string {
	switch (r.status) {
		case "answered": {
			const how =
				r.source === "option" ? `selected option ${(r.optionIndex ?? 0) + 1}` : "typed a custom answer";
			return `The user answered (${how}): ${r.answer}\nContinue the task using this answer.`;
		}
		case "cancelled":
			return (
				`No answer: ${r.reason}\n` +
				"Do NOT treat this as approval and do not guess the answer. " +
				"Pause this decision and ask the user in your reply, or continue only with work that does not depend on it."
			);
		case "unavailable":
			return (
				`ask_user unavailable: ${r.reason}\n` +
				"No answer was obtained. Do NOT assume one. State the open question in your reply so the user can answer it."
			);
		case "invalid":
			return `ask_user error: ${r.reason}`;
	}
}
