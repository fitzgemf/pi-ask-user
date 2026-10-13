import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { askUser, formatResult, CUSTOM_ANSWER_LABEL, type AskUserUI } from "../src/core.ts";
import askUserExtension, { askUserTool } from "../src/index.ts";

/** Scripted fake of Pi's ctx.ui that records every call. */
function fakeUI(script: { select?: (string | undefined)[]; input?: (string | undefined)[]; throws?: Error }) {
	const calls: { method: string; title: string; options?: string[] }[] = [];
	const selects = [...(script.select ?? [])];
	const inputs = [...(script.input ?? [])];
	const ui: AskUserUI = {
		async select(title, options) {
			calls.push({ method: "select", title, options });
			if (script.throws) throw script.throws;
			return selects.shift();
		},
		async input(title) {
			calls.push({ method: "input", title });
			if (script.throws) throw script.throws;
			return inputs.shift();
		},
	};
	return { ui, calls };
}

const Q = { question: "Which color theme should the page use?", options: ["Light", "Dark"] };

/** Runs the tool exactly as Pi does: execute(toolCallId, params, signal, onUpdate, ctx). */
async function runTool(params: unknown, ctx: unknown) {
	return askUserTool.execute("call-1", params as any, undefined, undefined, ctx);
}

describe("registration", () => {
	test("registers a tool named exactly ask_user with a JSON-schema question parameter", () => {
		const registered: any[] = [];
		askUserExtension({ registerTool: (t) => registered.push(t) });
		assert.equal(registered.length, 1);
		assert.equal(registered[0].name, "ask_user");
		assert.equal(typeof registered[0].execute, "function");
		assert.deepEqual(registered[0].parameters.required, ["question"]);
	});
});

describe("1. user selects a provided option", () => {
	test("returns the chosen option to the agent", async () => {
		const { ui, calls } = fakeUI({ select: ["Dark"] });
		const res = await runTool(Q, { hasUI: true, ui });

		assert.equal(calls.length, 1);
		assert.deepEqual(calls[0].options, ["Light", "Dark", CUSTOM_ANSWER_LABEL]);
		assert.equal(res.details.status, "answered");
		assert.equal((res.details as any).answer, "Dark");
		assert.equal((res.details as any).source, "option");
		assert.match(res.content[0].text, /The user answered \(selected option 2\): Dark/);
		assert.equal(res.isError, false);
	});

	test("hides the custom entry when allowCustom is false", async () => {
		const { ui, calls } = fakeUI({ select: ["Light"] });
		const r = await askUser({ ...Q, allowCustom: false }, { hasUI: true, ui });
		assert.deepEqual(calls[0].options, ["Light", "Dark"]);
		assert.equal(r.status, "answered");
	});
});

describe("2. user enters a custom answer", () => {
	test("via the custom entry in the option list", async () => {
		const { ui, calls } = fakeUI({ select: [CUSTOM_ANSWER_LABEL], input: ["  Solarized teal  "] });
		const res = await runTool(Q, { hasUI: true, ui });

		assert.deepEqual(
			calls.map((c) => c.method),
			["select", "input"],
		);
		assert.equal(res.details.status, "answered");
		assert.equal((res.details as any).answer, "Solarized teal");
		assert.equal((res.details as any).source, "custom");
		assert.match(res.content[0].text, /typed a custom answer\): Solarized teal/);
	});

	test("free-text question when no options are given", async () => {
		const { ui, calls } = fakeUI({ input: ["Ada Lovelace"] });
		const r = await askUser({ question: "Whose name goes in the header?" }, { hasUI: true, ui });
		assert.deepEqual(
			calls.map((c) => c.method),
			["input"],
		);
		assert.deepEqual(r, {
			status: "answered",
			question: "Whose name goes in the header?",
			answer: "Ada Lovelace",
			source: "custom",
		});
	});
});

describe("3. cancellation or empty response", () => {
	test("dismissing the option list is a cancellation, not approval", async () => {
		const { ui } = fakeUI({ select: [undefined] });
		const res = await runTool(Q, { hasUI: true, ui });
		assert.equal(res.details.status, "cancelled");
		assert.match(res.content[0].text, /Do NOT treat this as approval/);
		assert.doesNotMatch(res.content[0].text, /The user answered/);
	});

	test("empty / whitespace custom answer is treated as no answer", async () => {
		for (const typed of ["", "   ", undefined]) {
			const { ui } = fakeUI({ select: [CUSTOM_ANSWER_LABEL], input: [typed] });
			const r = await askUser(Q, { hasUI: true, ui });
			assert.equal(r.status, "cancelled", `input ${JSON.stringify(typed)}`);
		}
	});

	test("an already-aborted signal returns cancelled without prompting", async () => {
		const { ui, calls } = fakeUI({ select: ["Dark"] });
		const ac = new AbortController();
		ac.abort();
		const r = await askUser(Q, { hasUI: true, ui, signal: ac.signal });
		assert.equal(r.status, "cancelled");
		assert.equal(calls.length, 0);
	});

	test("an empty question is rejected as invalid", async () => {
		const { ui, calls } = fakeUI({});
		const res = await runTool({ question: "  " }, { hasUI: true, ui });
		assert.equal(res.details.status, "invalid");
		assert.equal(res.isError, true);
		assert.equal(calls.length, 0);
	});
});

describe("4. interactive UI unavailable", () => {
	test("hasUI false (print / headless mode) returns unavailable without calling the UI", async () => {
		const { ui, calls } = fakeUI({ select: ["Dark"] });
		const res = await runTool(Q, { hasUI: false, ui });
		assert.equal(res.details.status, "unavailable");
		assert.equal(calls.length, 0);
		assert.match(res.content[0].text, /ask_user unavailable/);
		assert.match(res.content[0].text, /Do NOT assume/);
	});

	test("missing ctx or ui returns unavailable", async () => {
		assert.equal((await runTool(Q, undefined)).details.status, "unavailable");
		assert.equal((await runTool(Q, { hasUI: true })).details.status, "unavailable");
	});

	test("a UI that throws is reported as unavailable", async () => {
		const { ui } = fakeUI({ throws: new Error("no TTY") });
		const r = await askUser(Q, { hasUI: true, ui });
		assert.equal(r.status, "unavailable");
		assert.match(formatResult(r), /no TTY/);
	});
});
