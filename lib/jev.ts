export const APPROVED_WORDS = [
  'grug', 'human', 'code', 'thing', 'good', 'bad', 'big', 'small', 'simple',
  'complex', 'make', 'use', 'need', 'want', 'know', 'think', 'try', 'fix',
  'break', 'ship', 'work', 'slow', 'fast', 'more', 'less', 'one', 'few',
  'many', 'now', 'first', 'why', 'what', 'yes', 'no', 'maybe', 'because',
  'but', 'and', 'if', 'then', 'enough', 'fire', 'rock', 'club', 'smart',
  'help', 'here', 'not', 'very', 'word', 'problem', 'ask', 'do', 'is', 'can',
  'jev', 'feel', 'pick', 'choice', 'in', 'again', 'later', 'before', 'by',
  'have', 'question', 'answer', 'machine', 'to', 'choose', 'that',
] as const;

export const END_CHOICE = 'end';
export const MAX_REPLY_WORDS = 18;

export type Message = { role: 'user' | 'grug'; text: string };

export type JevChoiceRequest = {
  state: {
    conversation: Message[];
    words_so_far: string[];
  };
  model: 'jev-latest';
  questions: {
    next_word: {
      type: 'choice';
      instructions: string;
      criteria: Record<string, string | null>;
    };
  };
};

export type JevDecision = {
  step: number;
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};

export function buildNextWordRequest(
  conversation: Message[],
  wordsSoFar: string[],
): JevChoiceRequest {
  const previousWord = wordsSoFar.at(-1);
  const criteria = Object.fromEntries([
    ...APPROVED_WORDS
      .filter((word) => word !== previousWord)
      .map((word) => [word, null] as const),
    [END_CHOICE, 'The reply is complete and should stop now.'],
  ]);

  return {
    state: {
      conversation: conversation.slice(-8),
      words_so_far: [...wordsSoFar],
    },
    model: 'jev-latest',
    questions: {
      next_word: {
        type: 'choice',
        instructions: [
          'Choose exactly one next word for the assistant named Grug.',
          'Grug gives useful, direct answers using primitive caveman grammar.',
          'Continue naturally from `words_so_far` and answer the latest user message in `conversation`.',
          'Do not repeat the immediately previous word.',
          'Choose `end` when the reply is complete. Prefer a short reply and choose `end` by 18 words.',
        ].join(' '),
        criteria,
      },
    },
  };
}
