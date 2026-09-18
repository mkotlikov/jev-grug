# grug.chat

> tiny vocabulary. big thought.

[Try the live demo](https://jev-grug-chat.mkotlikov.chatgpt.site/)

[TypeSafe says Jev isn't an LLM](https://docs.typesafe.ai/concepts/system-one). Let's talk to it anyway. Grug is a tiny cave-chat experiment that makes Jev hold a conversation by repeatedly choosing its next word from a compact vocabulary. What could grug wrong?

The demo now connects to the real Jev API when `TYPESAFE_API_KEY` is configured. Without a key it falls back to a deterministic mock, so contributors can still run the interface immediately.

## What is Jev?

Jev is TypeSafe AI's first *System One* model. Unlike a large language model, it does not generate arbitrary text. You provide a `state` plus one or more typed questions, and it returns structured answers that code can use directly.

This demo uses the [`choice`](https://docs.typesafe.ai/primitives/choice) primitive: one answer is selected from options defined in advance, accompanied by a probability distribution and confidence value. In the real API, all questions in one request are evaluated independently and in parallel. Grug intentionally runs a grouped tournament for every sequential word, so this is a toy inversion of Jev's intended use—not a recommended production chatbot architecture.

```text
conversation + words so far
            │
            ▼
  Jev Choice: "next word?"
            │
            ▼
 approved word │ end
            │
            └── repeat until end
```

The real request shape this project mirrors is:

```json
{
  "state": {
    "conversation": [{ "role": "user", "text": "How do I ship faster?" }],
    "words_so_far": ["make", "small"]
  },
  "model": "jev-latest",
  "questions": {
    "next_word": {
      "type": "choice",
      "instructions": "Choose the next word in Grug reply.",
      "criteria": {
        "thing": null,
        "first": null,
        "end": "The answer is complete."
      }
    }
  }
}
```

See the official [introduction](https://docs.typesafe.ai/introduction), [quick start](https://docs.typesafe.ai/introduction/quickstart), [state guide](https://docs.typesafe.ai/concepts/state), and [HTTP API reference](https://docs.typesafe.ai/api) for the authoritative interface.

## Run it

Requirements: Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env
# Add your TYPESAFE_API_KEY to .env
npm run dev
```

Open the local URL printed in the terminal. A production build is equally small:

```bash
npm run build
```

## How it works

- Keeps a compact 979-word vocabulary in [`lib/core-vocabulary.ts`](./lib/core-vocabulary.ts), with request builders in [`lib/jev.ts`](./lib/jev.ts).
- Gives every eligible word a chance through parallel groups of at most 249 options, then asks Jev to choose among each group’s strongest finalists or `end`.
- Carries the conversation and `words_so_far` forward as structured state.
- Extracts candidate names, numbers, and terms from user messages, then batches one Jev Noul judgment per non-numeric candidate to decide which words join the conversation vocabulary.
- Always admits numeric tokens and displays accepted and rejected conversation words in the inspector.
- Stops when Jev chooses the dedicated `end` control option or after 18 words.
- Withholds the three most recent words and words already used twice to prevent repetition loops.
- Validates every returned choice and retries documented `429` and `529` failures.
- Shows Jev's real probabilities and confidence in the inspector.
- Falls back to [`lib/mock-jev.ts`](./lib/mock-jev.ts) only when no key is configured.
- Exposes the same chat action through the experimental WebMCP browser interface when available.

The fallback is deterministic for the same prompt and conversation length, which makes the demo easy to inspect and test.

## API key safety

Create an API key in the [TypeSafe console](https://console.typesafe.ai/) and put it in `.env`:

```dotenv
TYPESAFE_API_KEY=your_key_here
```

Do **not** put the key in a `NEXT_PUBLIC_*` variable or call the authenticated API directly from browser code. The browser calls the project's server route; only that route talks to TypeSafe.

## Project structure

```text
app/
  layout.tsx       page metadata and fonts
  page.tsx         chat UI, trace inspector, and interaction loop
  globals.css      visual system and responsive layout
  api/chat/route.ts server-only Jev request loop and mock fallback
lib/
  core-vocabulary.ts compact common-English vocabulary
  jev.ts           vocabulary, shared types, and Choice request builder
  mock-jev.ts      deterministic fallback decisions
types/
  webmcp.d.ts      small browser API type declaration
```

## Notes on Jev

The public documentation describes Jev as an early-access model for fast, structured decisions. The API accepts a string, object, or array as state; `jev-latest` is the documented model alias; a Choice answer includes `choice`, `probabilities`, and `confidence`; and Choice supports a defined set of options. Jev is a product of TypeSafe AI. This project is an independent demo and is not affiliated with or endorsed by TypeSafe AI.

Research checked against TypeSafe AI's public documentation on September 17, 2026.

## License

[MIT](./LICENSE)

---

Created by **Michael Kotlikov**.
