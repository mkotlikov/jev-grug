import { NextResponse } from 'next/server';
import {
  APPROVED_WORDS,
  END_CHOICE,
  MAX_CHARACTER_REPLY_LENGTH,
  MAX_REPLY_WORDS,
  buildNextCharacterRequest,
  buildNextWordRequest,
  buildVocabularyRequest,
  findDynamicCandidates,
  isNumericCandidate,
  type GenerationMode,
  type JevDecision,
  type Message,
  type VocabularyDecision,
} from '@/lib/jev';
import { createMockCharacterReply, createMockReply } from '@/lib/mock-jev';

type ChoiceAnswer = {
  type: 'choice';
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};

type NoulAnswer = {
  type: 'noul';
  noul: number;
};

type SystemOneResponse = {
  answers?: Record<string, ChoiceAnswer | NoulAnswer>;
};

type SystemOneRequest = {
  state: unknown;
  model: 'jev-latest';
  questions: Record<string, unknown>;
};

function validMessages(value: unknown): value is Message[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 20 && value.every((message) => (
    typeof message === 'object' && message !== null
    && 'role' in message && (message.role === 'user' || message.role === 'grug')
    && 'text' in message && typeof message.text === 'string' && message.text.length <= 500
  ));
}

async function askJev(apiKey: string, body: SystemOneRequest) {
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
    const body = await request.json() as { messages?: unknown; mode?: unknown };
    if (!validMessages(body.messages)) {
      return NextResponse.json({ error: 'Send 1–20 valid chat messages.' }, { status: 400 });
    }
    if (body.mode !== undefined && body.mode !== 'word' && body.mode !== 'abc') {
      return NextResponse.json({ error: 'Mode must be word or abc.' }, { status: 400 });
    }

    const generationMode: GenerationMode = body.mode === 'abc' ? 'abc' : 'word';
    const apiKey = process.env.TYPESAFE_API_KEY;
    const candidates = findDynamicCandidates(body.messages);
    if (!apiKey) {
      const lastPrompt = body.messages.at(-1)?.text ?? '';
      if (generationMode === 'abc') {
        const result = createMockCharacterReply(lastPrompt, body.messages);
        return NextResponse.json({
          ...result,
          dynamicWords: [],
          vocabularyDecisions: [],
          generationMode,
          mode: 'mock' as const,
        });
      }
      const vocabularyDecisions: VocabularyDecision[] = candidates.map((word) => ({
        word,
        probability: 1,
        accepted: true,
        source: isNumericCandidate(word) ? 'number' : 'mock',
      }));
      const dynamicWords = vocabularyDecisions.map(({ word }) => word);
      const result = createMockReply(lastPrompt, body.messages, dynamicWords);
      return NextResponse.json({
        ...result,
        dynamicWords,
        vocabularyDecisions,
        generationMode,
        mode: 'mock' as const,
      });
    }

    if (generationMode === 'abc') {
      const characters: string[] = [];
      const decisions: JevDecision[] = [];

      for (let step = 1; step <= MAX_CHARACTER_REPLY_LENGTH; step += 1) {
        const jevRequest = buildNextCharacterRequest(body.messages, characters);
        const allowed = new Set(Object.keys(jevRequest.questions.next_word.criteria));
        const response = await askJev(apiKey, jevRequest);
        const answer = response.answers?.next_word;
        if (!answer || answer.type !== 'choice' || !allowed.has(answer.choice)) {
          throw new Error('Jev returned an invalid next-character choice.');
        }
        decisions.push({
          step,
          choice: answer.choice,
          probabilities: answer.probabilities,
          confidence: answer.confidence,
        });
        if (answer.choice === END_CHOICE) break;
        characters.push(answer.choice);
      }

      const completed = decisions.at(-1)?.choice === END_CHOICE;
      const text = characters.length ? `${characters.join('')}${completed ? '' : '…'}` : '…';
      return NextResponse.json({
        text,
        decisions,
        dynamicWords: [],
        vocabularyDecisions: [],
        generationMode,
        mode: 'jev' as const,
      });
    }

    const numberWords = candidates.filter(isNumericCandidate);
    const judgedCandidates = candidates.filter((word) => !isNumericCandidate(word));
    const vocabularyDecisions: VocabularyDecision[] = numberWords.map((word) => ({
      word,
      probability: 1,
      accepted: true,
      source: 'number',
    }));

    if (judgedCandidates.length) {
      const vocabularyResponse = await askJev(
        apiKey,
        buildVocabularyRequest(body.messages, judgedCandidates),
      );
      judgedCandidates.forEach((word, index) => {
        const answer = vocabularyResponse.answers?.[`word_${index}`];
        if (!answer || answer.type !== 'noul' || !Number.isFinite(answer.noul)) {
          throw new Error('Jev returned an invalid vocabulary decision.');
        }
        vocabularyDecisions.push({
          word,
          probability: answer.noul,
          accepted: answer.noul >= .5,
          source: 'jev',
        });
      });
    }

    const dynamicWords = vocabularyDecisions
      .filter(({ accepted }) => accepted)
      .map(({ word }) => word);
    const words: string[] = [];
    const decisions: JevDecision[] = [];
    const allowed = new Set<string>([...APPROVED_WORDS, ...dynamicWords, END_CHOICE]);

    for (let step = 1; step <= MAX_REPLY_WORDS; step += 1) {
      const jevRequest = buildNextWordRequest(body.messages, words, dynamicWords);
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
    return NextResponse.json({
      text,
      decisions,
      dynamicWords,
      vocabularyDecisions,
      generationMode,
      mode: 'jev' as const,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Grug could not reach Jev.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
