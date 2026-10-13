# Demo: 60–90 second recording script

Rehearsed on omp 18.10.0 with DeepSeek (`deepseek/deepseek-v4-flash`, the default model in the config).

## Before recording (not on camera)

```bash
mkdir -p ~/ask-user-demo && cd ~/ask-user-demo && rm -f index.html
```

Make the terminal large, about 120×35, so the option list and test output fit on screen.

## On camera

| Time | Action | Say (optional) |
|---|---|---|
| 0:00 | Show `src/index.ts` briefly (the `registerTool({ name: "ask_user" … })` block). | "This is a Pi extension that adds an `ask_user` tool." |
| 0:08 | In `~/ask-user-demo` run:<br>`omp -e /mnt/c/Users/mattf/workspace/pi-ask-user/src/index.ts` | |
| 0:12 | Paste the prompt below and press Enter. | "The color theme is a decision the agent shouldn't guess." |
| 0:20 | The agent calls **`ask_user`** and a pick list appears (Light / Dark / Custom / ✎ Type a custom answer…). | "The agent stops and asks me." |
| 0:25 | Choose **Dark** with the arrow keys and press Enter. *(Or, to show a custom answer, pick "✎ Type a custom answer…" and type `forest green`.)* | |
| 0:28 | The tool result appears: `The user answered (selected option 2): Dark`. The agent then writes `index.html`. | "The tool returns my answer to the agent." |
| 0:50 | Exit omp (Ctrl+C twice, or `/exit`). Run `grep -n -- '--bg' index.html` to show the dark background color. Optional: open the file with `explorer.exe index.html`. | "It used my choice." |
| 1:00 | `cd /mnt/c/Users/mattf/workspace/pi-ask-user && npm test` | "And the automated tests: option, custom answer, cancellation and empty input, and no-UI." |
| 1:10 | Stop on the summary `ℹ tests 14 … ℹ pass 14 ℹ fail 0`. | |

Prompt to paste:

```
Create a minimal HTML portfolio page for a computer science student in index.html. Before choosing the website's color theme, ask me to decide between light, dark, or a custom theme.
```

## Notes

- If omp asks you to approve the file write, approve it. That adds about two seconds.
- The model words the question and options itself, so the labels can differ a little between runs.
  A custom answer always works.
- If the model ever starts writing without asking, press Esc and send:
  `Use the ask_user tool to ask me about the theme first.`
- Pressing Esc on the question is the cancellation path. The agent receives
  "No answer … Do NOT treat this as approval", which also works as a demo.
