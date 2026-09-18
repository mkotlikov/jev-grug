import {
  APPROVED_TOKENS,
  ASCII_CHARACTERS,
  END_CHOICE,
  type JevDecision,
  type Message,
} from './jev';

export type MockDecision = JevDecision;

type Pattern = { when: RegExp; replies: string[] };

const PATTERNS: Pattern[] = [
  { when: /refactor|rewrite|architecture|framework/i, replies: [
    'if code work, no break code. make small fix first. ship now.',
    'complex thing feel smart but simple thing work. use less code.',
  ] },
  { when: /ship|fast|faster|speed|deadline/i, replies: [
    'make small thing. try thing. if good, ship now. more later.',
    'first know what human need. then use few code and ship.',
  ] },
  { when: /ai|artificial|jev|model|intelligence/i, replies: [
    'artificial intelligence is machine use data and pattern to learn, choose, and decide.',
    'jev not make word. jev choose one thing. grug ask again and again.',
  ] },
  { when: /meaning|life|deep/i, replies: [
    'life meaning is what human choose. love people, help, learn, and make good thing.',
  ] },
  { when: /rain|weather|tuesday|forecast/i, replies: [
    'grug not know future weather. check forecast for tuesday.',
  ] },
  { when: /hungry|food|eat/i, replies: [
    'no. grug is machine. grug not eat food.',
  ] },
  { when: /feel|feeling|happy|sad|angry|tired/i, replies: [
    'grug not have real feeling. but grug is curious and happy to help.',
  ] },
  { when: /bug|error|broken|fix|problem/i, replies: [
    'first know small problem. then fix one thing. try again. no big club.',
    'problem is thing that not work. make problem small. then fix.',
  ] },
  { when: /hello|hi|hey|who are/i, replies: ['hello human. grug here. what do you need?'] },
  { when: /should|do i|advice|help/i, replies: [
    'maybe. first ask why. if thing need work, make simple thing. then try.',
    'grug think yes, but small first. use rock before big club.',
  ] },
  { when: /.*/i, replies: [
    'grug think thing is complex. make thing small. then know what to do.',
    'human ask big question. grug have few word. simple answer: try small thing first.',
    'maybe yes. maybe no. know by make small thing and try.',
  ] },
];

function hash(value: string) {
  let result = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    result ^= value.charCodeAt(i);
    result = Math.imul(result, 16777619);
  }
  return Math.abs(result >>> 0);
}

function replyTokens(reply: string) {
  return reply.toLowerCase().match(/\d+(?:[.,]\d+)*|[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*|[.,?!]/gu) ?? [];
}

function makeDistribution(choice: string, seed: number, pool: readonly string[] = APPROVED_TOKENS) {
  const distractors = pool
    .filter((word) => word !== choice)
    .sort((a, b) => hash(`${seed}-${a}`) - hash(`${seed}-${b}`))
    .slice(0, 4);
  const certainty = .56 + (seed % 31) / 100;
  const remaining = 1 - certainty;
  const raw = distractors.map((_, index) => (distractors.length - index) * (1 + ((seed >> index) % 4)));
  const total = raw.reduce((sum, value) => sum + value, 0);
  const probabilities: Record<string, number> = { [choice]: certainty };
  distractors.forEach((word, index) => {
    probabilities[word] = Number((remaining * raw[index] / total).toFixed(3));
  });
  return { probabilities, confidence: Math.min(.96, certainty + .08) };
}

export function createMockReply(prompt: string, history: Message[], dynamicWords: string[] = []) {
  const pattern = PATTERNS.find((entry) => entry.when.test(prompt)) ?? PATTERNS[PATTERNS.length - 1];
  const seed = hash(`${prompt}:${history.length}`);
  const reply = pattern.replies[seed % pattern.replies.length];
  const tokens = replyTokens(reply);
  const choices = [...tokens, END_CHOICE];
  const allowed = new Set<string>([...APPROVED_TOKENS, ...dynamicWords]);
  const unknown = tokens.filter((token) => !allowed.has(token));
  if (unknown.length) throw new Error(`Mock reply used unapproved words: ${unknown.join(', ')}`);

  const decisions = choices.map((choice, index) => {
    return {
      step: index + 1,
      choice,
      ...makeDistribution(choice, seed + index * 97),
    };
  });

  return { text: reply, decisions };
}

export function createMockCharacterReply(prompt: string, history: Message[]) {
  const wordReply = createMockReply(prompt, history);
  const seed = hash(`${prompt}:${history.length}:abc`);
  const choices = [...wordReply.text.split(''), END_CHOICE];
  const decisions = choices.map((choice, index) => ({
    step: index + 1,
    choice,
    ...makeDistribution(choice, seed + index * 97, ASCII_CHARACTERS),
  }));

  return { text: wordReply.text, decisions };
}
