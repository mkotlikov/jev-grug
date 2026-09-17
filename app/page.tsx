'use client';

import { type BaseSyntheticEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  APPROVED_WORDS,
  END_CHOICE,
  type JevDecision,
  type Message,
  type VocabularyDecision,
} from '@/lib/jev';

type ChatResponse = {
  text: string;
  decisions: JevDecision[];
  dynamicWords: string[];
  vocabularyDecisions: VocabularyDecision[];
  mode: 'jev' | 'mock';
};

const STARTER_MESSAGES: Message[] = [{
  role: 'grug',
  text: 'grug here. grug know few word. few word enough. what human need?',
}];

const EXAMPLES = [
  'Should I refactor working code?',
  'How do I ship faster?',
  'Explain artificial intelligence.',
];

function ProbabilityBar({ decision }: { decision: JevDecision }) {
  const top = Object.entries(decision.probabilities)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <div className="trace-card">
      <div className="trace-card__head">
        <span>choice #{String(decision.step).padStart(2, '0')}</span>
        <span>{Math.round(decision.confidence * 100)}% sure</span>
      </div>
      <div className="trace-card__bars">
        {top.map(([word, probability]) => (
          <div className="probability" key={word}>
            <span className={word === decision.choice ? 'selected' : ''}>
              {word === END_CHOICE ? 'END' : word}
            </span>
            <i><b style={{ width: `${Math.max(probability * 100, 2)}%` }} /></i>
            <em>{Math.round(probability * 100)}%</em>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>(STARTER_MESSAGES);
  const [input, setInput] = useState('');
  const [trace, setTrace] = useState<JevDecision[]>([]);
  const [dynamicWords, setDynamicWords] = useState<string[]>([]);
  const [vocabularyTrace, setVocabularyTrace] = useState<VocabularyDecision[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [mode, setMode] = useState<'checking' | 'jev' | 'mock'>('checking');
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const sendMessage = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean || isThinking) return;

    const nextMessages = [...messages, { role: 'user' as const, text: clean }];
    setMessages(nextMessages);
    setInput('');
    setIsThinking(true);
    setTrace([]);
    setError('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, mode: 'word' }),
      });
      const payload = await response.json() as ChatResponse | { error?: string };
      if (!response.ok || !('text' in payload)) {
        throw new Error('error' in payload && payload.error ? payload.error : 'Grug could not reach Jev.');
      }

      setMode(payload.mode);
      setDynamicWords(payload.dynamicWords);
      setVocabularyTrace(payload.vocabularyDecisions);
      for (let i = 0; i < payload.decisions.length; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 45));
        setTrace(payload.decisions.slice(0, i + 1));
      }

      setMessages((current) => [...current, { role: 'grug', text: payload.text }]);
      return payload.text;
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Grug could not reach Jev.';
      setError(message);
      throw requestError;
    } finally {
      setIsThinking(false);
    }
  }, [isThinking, messages]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();

    void Promise.resolve(context.registerTool({
      name: 'send_grug_message',
      title: 'Send message to Grug',
      description: 'Send one message to the visible Grug chat and return Grug’s completed Jev reply.',
      inputSchema: {
        type: 'object',
        properties: { message: { type: 'string', minLength: 1, maxLength: 500 } },
        required: ['message'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      async execute(input: unknown) {
        if (isThinking) throw new Error('Grug is already choosing words.');
        const message = typeof input === 'object' && input !== null && 'message' in input
          ? (input as { message: unknown }).message
          : undefined;
        if (typeof message !== 'string' || !message.trim() || message.length > 500) {
          throw new Error('message must be a non-empty string of at most 500 characters');
        }
        const reply = await sendMessage(message);
        return {
          reply,
          mode,
          baseVocabularySize: APPROVED_WORDS.length,
          conversationWords: dynamicWords,
          generationMode: 'word',
        };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);

    return () => lifecycle.abort();
  }, [dynamicWords, isThinking, mode, sendMessage]);

  function onSubmit(event: BaseSyntheticEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  function reset() {
    setMessages(STARTER_MESSAGES);
    setTrace([]);
    setDynamicWords([]);
    setVocabularyTrace([]);
    setInput('');
    setError('');
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Grug Chat home">
          <span className="brand-mark">G</span>
          <span>GRUG.CHAT</span>
        </a>
        <div className="topbar__right">
          <span className={`status-pill status-pill--${mode}`}>
            <i /> {mode === 'jev' ? 'live jev' : mode === 'mock' ? 'mock fallback' : 'jev api'}
          </span>
          <a className="docs-link" href="https://docs.typesafe.ai/introduction" target="_blank" rel="noreferrer">
            Jev docs ↗
          </a>
        </div>
      </header>

      <section className="workspace" id="top">
        <div className="chat-panel">
          <div className="intro">
            <p className="eyebrow"><Sparkles size={14} /> TINY VOCABULARY. BIG THOUGHT.</p>
            <h1>Chat with <span>grug.</span></h1>
            <p>TypeSafe says Jev isn&apos;t an LLM. Let&apos;s talk to it anyway. What could grug wrong?</p>
          </div>

          <div className="messages" aria-live="polite">
            {messages.map((message, index) => (
              <article className={`message message--${message.role}`} key={`${message.role}-${index}`}>
                <span className="message__label">{message.role === 'grug' ? 'GRUG' : 'YOU'}</span>
                <p>{message.text}</p>
              </article>
            ))}
            {isThinking && (
              <article className="message message--grug message--thinking">
                <span className="message__label">GRUG</span>
                <p>grug choose word<span className="thinking-dots">...</span></p>
              </article>
            )}
            {error && (
              <article className="message message--error" role="alert">
                <span className="message__label">ERROR</span>
                <p>{error}</p>
              </article>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="composer-wrap">
            {messages.length === 1 && (
              <div className="suggestions" aria-label="Example prompts">
                {EXAMPLES.map((example) => (
                  <button key={example} onClick={() => void sendMessage(example)} type="button">{example}</button>
                ))}
              </div>
            )}
            <form className="composer" onSubmit={onSubmit}>
              <Textarea
                aria-label="Message Grug"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage(input);
                  }
                }}
                placeholder="ask grug thing..."
                rows={1}
              />
              <Button aria-label="Send message" disabled={!input.trim() || isThinking} size="icon" type="submit">
                <ArrowUp size={19} />
              </Button>
            </form>
            <div className="composer-meta">
              <span>{mode === 'mock' ? 'Mock fallback · API key not configured' : 'Jev API · key stays server-side'}</span>
              <button onClick={reset} type="button"><RotateCcw size={13} /> reset</button>
            </div>
          </div>
        </div>

        <aside className="inspector">
          <div className="inspector__header">
            <div><span className="kicker">LIVE INSPECTOR</span><h2>Jev chooses.</h2></div>
            <span className="pulse-dot" aria-label="Jev connection active" />
          </div>
          <div className="explain-card">
            <code>prompt → noul → vocab<br />groups → finalists → word</code><p>Jev first admits useful prompt terms. Then every eligible core word enters a grouped tournament, and Jev chooses among the finalists—or <b>END</b>.</p>
          </div>

          <section className="vocabulary-section vocabulary-section--dynamic">
            <div className="section-title"><h3>Words from this chat</h3><span>{dynamicWords.length} added</span></div>
            {vocabularyTrace.length ? (
              <div className="word-cloud word-cloud--dynamic">
                {vocabularyTrace.map(({ word, probability, accepted, source }) => (
                  <span className={accepted ? 'accepted' : 'rejected'} key={word}>
                    {word}<small>{source === 'number' ? 'number' : `${Math.round(probability * 100)}%`}</small>
                  </span>
                ))}
              </div>
            ) : <p className="vocabulary-empty">New names, terms, and numbers will appear here.</p>}
          </section>

          <section className="trace-section">
            <div className="section-title"><h3>Latest trace</h3><span>{trace.length} choices</span></div>
            <div className="trace-list">
              {trace.length ? trace.slice(-5).reverse().map((decision) => (
                <ProbabilityBar decision={decision} key={decision.step} />
              )) : (
                <div className="empty-trace"><span>?</span><p>Ask something. Grug probabilities appear here.</p></div>
              )}
            </div>
          </section>

          <section className="vocabulary-section">
            <div className="section-title">
              <h3>Approved words</h3>
              <span>{APPROVED_WORDS.length}</span>
            </div>
            <div className="word-cloud">
              {APPROVED_WORDS.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </section>
        </aside>
      </section>

      <footer>
        <p>Built by Michael Kotlikov</p>
        <p>Jev is a product of TypeSafe AI. This independent demo is not affiliated with TypeSafe.</p>
      </footer>
    </main>
  );
}
