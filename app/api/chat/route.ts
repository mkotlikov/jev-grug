import { NextResponse } from 'next/server';
import {
  APPROVED_WORDS,
  END_CHOICE,
  MAX_REPLY_WORDS,
  buildNextWordRequest,
  type JevDecision,
  type Message,
} from '@/lib/jev';
import { createMockReply } from '@/lib/mock-jev';

type ChoiceAnswer = {
  type: 'choice';
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};

type SystemOneResponse = {
  answers?: { next_word?: ChoiceAnswer };
};

function validMessages(value: unknown): value is Message[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 20 && value.every((message) => (
    typeof message === 'object' && message !== null
    && 'role' in message && (message.role === 'user' || message.role === 'grug')
    && 'text' in message && typeof message.text === 'string' && message.text.length <= 500
  ));
}

async function askJev(apiKey: string, body: ReturnType<typeof buildNextWordRequest>) {
  let lastError = 'Jev request failed.';

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) return await response.json() as SystemOneResponse;

    const detail = await response.text();
    lastError = `Jev returned ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ''}`;
    if (response.status !== 429 && response.status !== 529) break;
    await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt)));
  }

  throw new Error(lastError);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { messages?: unknown };
    if (!validMessages(body.messages)) {
      return NextResponse.json({ error: 'Send 1–20 valid chat messages.' }, { status: 400 });
    }

    const apiKey = process.env.TYPESAFE_API_KEY;
    if (!apiKey) {
      const lastPrompt = body.messages.at(-1)?.text ?? '';
      const result = createMockReply(lastPrompt, body.messages);
      return NextResponse.json({ ...result, mode: 'mock' as const });
    }

    const words: string[] = [];
    const decisions: JevDecision[] = [];
    const allowed = new Set<string>([...APPROVED_WORDS, END_CHOICE]);

    for (let step = 1; step <= MAX_REPLY_WORDS; step += 1) {
      const jevRequest = buildNextWordRequest(body.messages, words);
      const response = await askJev(apiKey, jevRequest);
      const answer = response.answers?.next_word;

      if (!answer || answer.type !== 'choice' || !allowed.has(answer.choice)) {
        throw new Error('Jev returned an invalid next-word choice.');
      }

      decisions.push({
        step,
        choice: answer.choice,
        probabilities: answer.probabilities,
        confidence: answer.confidence,
      });

      if (answer.choice === END_CHOICE) break;
      words.push(answer.choice);
    }

    const completed = decisions.at(-1)?.choice === END_CHOICE;
    const text = words.length ? `${words.join(' ')}${completed ? '.' : '…'}` : '…';
    return NextResponse.json({ text, decisions, mode: 'jev' as const });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Grug could not reach Jev.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
