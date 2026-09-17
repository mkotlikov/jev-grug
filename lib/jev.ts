export const APPROVED_WORDS = [
  'grug', 'human', 'code', 'thing', 'good', 'bad', 'big', 'small', 'simple',
  'complex', 'make', 'use', 'need', 'want', 'know', 'think', 'try', 'fix',
  'break', 'ship', 'work', 'slow', 'fast', 'more', 'less', 'one', 'few',
  'many', 'now', 'first', 'why', 'what', 'yes', 'no', 'maybe', 'because',
  'but', 'and', 'if', 'then', 'enough', 'fire', 'rock', 'club', 'smart',
  'help', 'here', 'not', 'very', 'word', 'problem', 'ask', 'do', 'is', 'can',
  'jev', 'feel', 'pick', 'choice', 'in', 'again', 'later', 'before', 'by',
  'have', 'question', 'answer', 'machine', 'to', 'choose', 'that',
  'hello', 'hi', 'thanks', 'please', 'say', 'tell', 'explain',
  'artificial', 'intelligence', 'learn', 'data', 'pattern', 'decide',
  'understand', 'information', 'task',
  'life', 'meaning', 'live', 'love', 'care', 'people', 'world', 'purpose',
  'find', 'time',
  'rain', 'weather', 'day', 'today', 'tomorrow', 'tuesday', 'forecast',
  'outside', 'future', 'check',
  'hungry', 'food', 'eat', 'feeling', 'happy', 'sad', 'tired', 'angry',
  'curious', 'true', 'real', 'pretend',
  'am', 'are', 'it', 'this', 'you', 'me', 'my', 'your', 'we', 'could',
  'will', 'only', 'from', 'with', 'for', 'about', 'like',
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
  const recentWords = new Set(wordsSoFar.slice(-3));
  const wordCounts = new Map<string, number>();
  wordsSoFar.forEach((word) => wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1));
  const criteria = Object.fromEntries([
    ...APPROVED_WORDS
      .filter((word) => !recentWords.has(word) && (wordCounts.get(word) ?? 0) < 2)
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
          'The three most recent words and any word already used twice are unavailable to prevent repetition loops.',
          'Do not claim current or future facts that are not present in the conversation; say Grug does not know and suggest checking.',
          'Choose `end` when the reply is complete. Prefer a short reply and choose `end` by 18 words.',
        ].join(' '),
        criteria,
      },
    },
  };
}
