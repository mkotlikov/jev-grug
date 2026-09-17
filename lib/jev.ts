import { CORE_WORDS } from '@/lib/core-vocabulary';

const GRUG_WORDS = [
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
  'a', 'an', 'the', 'of', 'on', 'at', 'as', 'or', 'than', 'same',
  'different', 'better', 'best', 'most', 'who', 'which', 'where', 'when',
  'how', 'person', 'name', 'looks', 'handsome', 'magic', 'new', 'old',
  'much', 'really', 'also', 'does', 'did', 'has', 'had', 'was', 'were',
  'be', 'been', 'get', 'got', 'see', 'look', 'come', 'go', 'give', 'take',
  'zero', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty', 'hundred', 'thousand',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12',
  '13', '14', '15', '16', '17', '18', '19', '20',
] as const;

export const APPROVED_WORDS = [...new Set<string>([
  ...CORE_WORDS.filter((word) => word !== 'end'),
  ...GRUG_WORDS,
])];

export const END_CHOICE = 'end';
export const NONE_CHOICE = '__none__';
export const MAX_REPLY_WORDS = 18;
export const MAX_WORDS_PER_CHOICE = 249;
export const MAX_CHARACTER_REPLY_LENGTH = 64;
export const ASCII_CHARACTERS = Array.from("abcdefghijklmnopqrstuvwxyz0123456789' ?.");

export type GenerationMode = 'word' | 'abc';

export type Message = { role: 'user' | 'grug'; text: string };

export type JevChoiceRequest = {
  state: {
    conversation: Message[];
    words_so_far: string[];
    conversation_vocabulary: string[];
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

export type JevCharacterRequest = {
  state: {
    conversation: Message[];
    characters_so_far: string;
    blocked_characters: string[];
  };
  model: 'jev-latest';
  questions: JevChoiceRequest['questions'];
};

export type JevDecision = {
  step: number;
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};

export type VocabularyDecision = {
  word: string;
  probability: number;
  accepted: boolean;
  source: 'jev' | 'number' | 'mock';
};

const BASE_WORDS = new Set<string>(APPROVED_WORDS);
const TOKEN_PATTERN = /\d+(?:[.,]\d+)*|[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

function normalizeCandidate(word: string) {
  return word.toLocaleLowerCase().replaceAll('’', "'");
}

export function findDynamicCandidates(conversation: Message[]) {
  const candidates: string[] = [];
  const seen = new Set<string>();

  for (const message of conversation.slice(-12)) {
    if (message.role !== 'user') continue;
    for (const match of message.text.matchAll(TOKEN_PATTERN)) {
      const word = normalizeCandidate(match[0]);
      if (
        word.length > 24
        || BASE_WORDS.has(word)
        || word === END_CHOICE
        || seen.has(word)
      ) continue;
      seen.add(word);
      candidates.push(word);
    }
  }

  return candidates.slice(-24);
}

export function isNumericCandidate(word: string) {
  return /^\d+(?:[.,]\d+)*$/.test(word);
}

export function buildVocabularyRequest(conversation: Message[], candidates: string[]) {
  const questions = Object.fromEntries(candidates.map((word, index) => [
    `word_${index}`,
    {
      type: 'noul' as const,
      instructions: [
        `Should the exact candidate word \`${word}\` be added to Grug's temporary conversation vocabulary?`,
        'Answer yes when it is a name, specialized term, quoted word, topic, object, or descriptor that helps answer the latest user message.',
        'Answer no when it is an accidental fragment, meaningless text, or irrelevant to answering.',
      ].join(' '),
      criteria: {
        true: `Grug may need to say the exact word \`${word}\` in this conversation.`,
        false: `Grug does not need the exact word \`${word}\` to answer.`,
      },
    },
  ]));

  return {
    state: {
      conversation: conversation.slice(-8),
      candidate_words: candidates,
      purpose: 'Choose useful words from the user conversation to temporarily expand Grug vocabulary.',
    },
    model: 'jev-latest' as const,
    questions,
  };
}

export function buildNextWordRequest(
  conversation: Message[],
  wordsSoFar: string[],
  dynamicWords: string[] = [],
): JevChoiceRequest {
  const recentWords = new Set(wordsSoFar.slice(-3));
  const wordCounts = new Map<string, number>();
  wordsSoFar.forEach((word) => wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1));
  const availableWords = [...new Set<string>([...APPROVED_WORDS, ...dynamicWords])];
  const criteria = Object.fromEntries([
    ...availableWords
      .filter((word) => !recentWords.has(word) && (wordCounts.get(word) ?? 0) < 2)
      .map((word) => [word, null] as const),
    [END_CHOICE, 'The reply is complete and should stop now.'],
  ]);

  return {
    state: {
      conversation: conversation.slice(-8),
      words_so_far: [...wordsSoFar],
      conversation_vocabulary: [...dynamicWords],
    },
    model: 'jev-latest',
    questions: {
      next_word: {
        type: 'choice',
        instructions: [
          'Choose exactly one next word for the assistant named Grug.',
          'Grug gives useful, direct answers using primitive caveman grammar.',
          'Continue naturally from `words_so_far` and answer the latest user message in `conversation`.',
          'Words in `conversation_vocabulary` came directly from the user conversation and may be used exactly as written.',
          'The three most recent words and any word already used twice are unavailable to prevent repetition loops.',
          'Do not claim current or future facts that are not present in the conversation; say Grug does not know and suggest checking.',
          'Choose `end` when the reply is complete. Prefer a short reply and choose `end` by 18 words.',
        ].join(' '),
        criteria,
      },
    },
  };
}

function availableReplyWords(wordsSoFar: string[], dynamicWords: string[]) {
  const recentWords = new Set(wordsSoFar.slice(-3));
  const wordCounts = new Map<string, number>();
  wordsSoFar.forEach((word) => wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1));
  return [...new Set<string>([...APPROVED_WORDS, ...dynamicWords])]
    .filter((word) => word !== END_CHOICE && word !== NONE_CHOICE)
    .filter((word) => !recentWords.has(word) && (wordCounts.get(word) ?? 0) < 2);
}

export function buildNextWordTournamentRequest(
  conversation: Message[],
  wordsSoFar: string[],
  dynamicWords: string[] = [],
) {
  const words = availableReplyWords(wordsSoFar, dynamicWords);
  const groups = Array.from(
    { length: Math.ceil(words.length / MAX_WORDS_PER_CHOICE) },
    (_, index) => words.slice(index * MAX_WORDS_PER_CHOICE, (index + 1) * MAX_WORDS_PER_CHOICE),
  );
  const questions = Object.fromEntries(groups.map((group, index) => [
    `word_group_${index}`,
    {
      type: 'choice' as const,
      instructions: [
        'Choose the best next word from this candidate group for the assistant named Grug.',
        'Grug gives a useful, direct answer with primitive caveman grammar.',
        'Continue naturally from `words_so_far` and answer the latest user message in `conversation`.',
        `Choose ${NONE_CHOICE} when no word in this group is a good continuation.`,
      ].join(' '),
      criteria: Object.fromEntries([
        ...group.map((word) => [word, null] as const),
        [NONE_CHOICE, 'No word in this group is a useful next word.'],
      ]),
    },
  ]));

  return {
    state: {
      conversation: conversation.slice(-8),
      words_so_far: [...wordsSoFar],
      conversation_vocabulary: [...dynamicWords],
    },
    model: 'jev-latest' as const,
    questions,
  };
}

export function buildNextWordFinalRequest(
  conversation: Message[],
  wordsSoFar: string[],
  finalists: string[],
  dynamicWords: string[] = [],
): JevChoiceRequest {
  return {
    state: {
      conversation: conversation.slice(-8),
      words_so_far: [...wordsSoFar],
      conversation_vocabulary: [...dynamicWords],
    },
    model: 'jev-latest',
    questions: {
      next_word: {
        type: 'choice',
        instructions: [
          'Choose the single best next word for the assistant named Grug from the tournament finalists.',
          'Grug gives useful, direct answers using primitive caveman grammar.',
          'Continue naturally from `words_so_far` and answer the latest user message in `conversation`.',
          'Choose `end` when the reply is complete. Prefer a short reply and choose `end` by 18 words.',
        ].join(' '),
        criteria: Object.fromEntries([
          ...finalists.map((word) => [word, null] as const),
          [END_CHOICE, 'The reply is complete and should stop now.'],
        ]),
      },
    },
  };
}

export function buildNextCharacterRequest(
  conversation: Message[],
  charactersSoFar: string[],
): JevCharacterRequest {
  const blockedCharacters = new Set<string>();
  const textSoFar = charactersSoFar.join('');
  const lastCharacter = charactersSoFar.at(-1);

  // Jev chooses from only the criteria we provide. Temporarily removing a
  // repeated character makes it impossible for a low-confidence choice to
  // turn into an endless "HHHH..."-style run.
  if (lastCharacter === ' ' || (lastCharacter && charactersSoFar.at(-2) === lastCharacter)) {
    blockedCharacters.add(lastCharacter);
  }

  // Also interrupt short loops such as "ha ha ha" or "abcabcabc" while
  // leaving ordinary doubled punctuation and letters available.
  for (let patternLength = 2; patternLength <= 4; patternLength += 1) {
    const repeatedLength = patternLength * 3;
    if (textSoFar.length < repeatedLength) continue;
    const tail = textSoFar.slice(-repeatedLength);
    const pattern = tail.slice(0, patternLength);
    if (tail === pattern.repeat(3)) blockedCharacters.add(pattern[0]);
  }

  const criteria = Object.fromEntries([
    ...ASCII_CHARACTERS
      .filter((character) => !blockedCharacters.has(character))
      .map((character) => [
        character,
        character === ' ' ? 'A space between words.' : `The printable ASCII character ${JSON.stringify(character)}.`,
      ] as const),
    [END_CHOICE, 'End of transmission. The reply is complete and no more characters should be sent.'],
  ]);

  return {
    state: {
      conversation: conversation.slice(-8),
      characters_so_far: textSoFar,
      blocked_characters: [...blockedCharacters],
    },
    model: 'jev-latest',
    questions: {
      next_word: {
        type: 'choice',
        instructions: [
          'Choose exactly one next character for the assistant named Grug.',
          '`characters_so_far` is the exact reply prefix already emitted. Select only the single character that immediately follows it; never restart or echo the prefix.',
          'Continue one coherent, useful, direct reply to the latest user message in `conversation`.',
          'The available characters are lowercase a through z, digits 0 through 9, apostrophe, space, question mark, and period.',
          'Characters listed in `blocked_characters` are temporarily unavailable because code detected a repetition loop.',
          'Choose `end` only as the end-of-transmission control when the reply is complete; do not spell the control word into the reply.',
          'If the reply is complete or you are stuck, choose `end` instead of filler. Prefer a concise reply and choose `end` by 64 characters.',
        ].join(' '),
        criteria,
      },
    },
  };
}

export function displayCharacter(character: string) {
  return character === ' ' ? 'SPACE' : character;
}
