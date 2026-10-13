# pi-ask-user

A [Pi](https://github.com/badlogic/pi-mono) / [Oh My Pi](https://github.com/can1357/oh-my-pi) extension that
gives the coding agent a model-callable **`ask_user`** tool. When the agent hits an important decision it
can't resolve on its own, it asks you, waits for your answer, and continues with it.

- Pick from suggested options, or type a custom answer.
- Cancelling (Esc) or submitting an empty answer returns **"no answer, do not treat as approval"**. It never
  returns a fake "yes".
- With no interactive UI (`-p` print mode, JSON/headless), the tool returns a clear *unavailable* result
  instead of hanging.
- No runtime dependencies. The core logic (`src/core.ts`) is UI-agnostic and unit-tested with a fake UI.

## Install / load

Requires Node ≥ 22.18 for the tests (TypeScript runs natively). Pi/OMP load the `.ts` files directly, so
there is no build step.

```bash
git clone https://github.com/fitzgemf/pi-ask-user.git
cd pi-ask-user

# Oh My Pi (tested with omp 18.10.0)
omp -e ./src/index.ts

# upstream Pi (same extension API; not live-tested here)
pi -e ./src/index.ts
```

`-e` takes an absolute or relative path, so you can launch the agent from any project directory:
`omp -e /path/to/pi-ask-user/src/index.ts`. `package.json` also declares a `pi.extensions` manifest
for package-based installs.

On OMP the tool sets `loadMode: "essential"`, so it is a top-level tool rather than a deferred one.
OMP already ships a built-in tool named `ask`. This extension registers `ask_user`, so the two don't collide.

## Usage

Ask for something that involves a real choice:

```
Create a minimal HTML portfolio page for a computer science student. Before choosing the
website's color theme, ask me to decide between light, dark, or a custom theme.
```

The agent calls `ask_user` with:

| Parameter     | Type       | Notes                                                       |
|---------------|------------|-------------------------------------------------------------|
| `question`    | string     | Required. Must not be empty.                                |
| `options`     | string[]   | Optional pick list. Leave it out to ask a free-text question.  |
| `allowCustom` | boolean    | Default `true`. Adds a "✎ Type a custom answer…" entry.     |
| `context`     | string     | Optional explanation shown under the question.              |

The model receives one of these results (`details.status` holds the same state as structured data):

| Outcome     | Text returned to the model                                                      |
|-------------|----------------------------------------------------------------------------------|
| answered    | `The user answered (selected option 2): Dark` / `(typed a custom answer): …`     |
| cancelled   | `No answer: … Do NOT treat this as approval and do not guess the answer. …`      |
| unavailable | `ask_user unavailable: No interactive UI is available … Do NOT assume one. …`    |
| invalid     | `ask_user error: The 'question' parameter must be a non-empty string.`           |

## Tests

```bash
npm test
```

This runs `node --test` on `test/ask-user.test.ts`, with no install step. It covers:

1. selecting a provided option
2. entering a custom answer (via the custom entry, or as a free-text question)
3. cancellation, empty or whitespace answers, an aborted request, and an empty question
4. unavailable UI (`hasUI: false`, missing `ctx`/`ui`, or a UI that throws)

It also checks that the extension registers a tool named exactly `ask_user`. The tests drive the
registered tool's real `execute(toolCallId, params, signal, onUpdate, ctx)`, the same call Pi makes.

## Layout

```
docs/DEMO.md   60-90 s recording script
src/core.ts    askUser() + formatResult(): pure logic, with a small UI interface
src/index.ts   extension entry: registers the ask_user tool
test/          node:test suite with a scripted fake UI
```

## License

MIT
