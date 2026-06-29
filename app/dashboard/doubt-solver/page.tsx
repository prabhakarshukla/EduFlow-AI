'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { captureEvent } from '@/lib/posthog/helpers';
import { EVENTS } from '@/lib/posthog/events';
import { FormattedNote } from '@/components/notes/formatted-note';
import { useFeatureStatus } from '@/hooks/useFeatureStatus';

type SolverStatus = 'idle' | 'loading' | 'success' | 'error';

type SolverResult = {
  answer: string;
  source?: string;
};

const exampleQuestions = [
  "Explain Newton's 3rd Law with examples",
  "What is the difference between mitosis and meiosis?",
  "How does a capacitor charge and discharge?",
  "Explain the concept of limits in calculus",
];

export default function DoubtSolverPage() {
  const { status: featureStatus, loading: featureLoading } = useFeatureStatus();
  const isAiActive = featureStatus ? featureStatus.ai.active : true;

  const [question, setQuestion] = useState('');
  const [status, setStatus] = useState<SolverStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SolverResult | null>(null);
  const [displayedAnswer, setDisplayedAnswer] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const canSubmit = useMemo(() => isAiActive && question.trim().length > 0 && status !== 'loading', [isAiActive, question, status]);

  const resetState = () => {
    setStatus('idle');
    setError(null);
    setResult(null);
    setDisplayedAnswer('');
    setIsTyping(false);
  };

  useEffect(() => {
    if (status !== 'success' || !result?.answer) return;

    setDisplayedAnswer('');
    setIsTyping(true);

    let index = 0;
    const chunkSize = 4;
    const timer = window.setInterval(() => {
      index += chunkSize;
      setDisplayedAnswer(result.answer.slice(0, index));

      if (index >= result.answer.length) {
        window.clearInterval(timer);
        setIsTyping(false);
      }
    }, 12);

    return () => window.clearInterval(timer);
  }, [result?.answer, status]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;

    setStatus('loading');
    setError(null);
    setResult(null);
    setDisplayedAnswer('Thinking...');
    captureEvent(EVENTS.DOUBT_SUBMITTED, { question_length: q.length });

    try {
      const res = await fetch('/api/doubt-solver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });

      const data = (await res.json()) as { answer?: string; source?: string; error?: string };

      if (!res.ok) throw new Error(data.error || 'Failed to generate answer.');
      if (!data.answer || !data.answer.trim()) throw new Error('AI returned an empty answer.');

      setResult({ answer: data.answer.trim(), source: data.source || 'ai' });
      captureEvent(EVENTS.DOUBT_ANSWERED, { success: true });
      setStatus('success');
    } catch (err) {
      captureEvent(EVENTS.DOUBT_SOLVER_ERROR, { error: err instanceof Error ? err.message : 'unknown' });
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong while processing your question.');
    }
  };

  return (
    <div className="px-6 sm:px-8 py-8 max-w-4xl mx-auto space-y-6">

      <div>
        <div
          className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-3"
          style={{ background: 'rgba(110,231,216,0.08)', color: '#6EE7D8', border: '1px solid rgba(110,231,216,0.18)' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          AI Doubt Solver
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--ui-heading)' }}>
          Ask any academic doubt.
        </h1>
        <p className="text-sm mt-1.5" style={{ color: 'var(--ui-muted)' }}>
          Type your question clearly and get an instant AI-generated explanation with examples.
        </p>
      </div>

      {!featureLoading && !isAiActive && (
        <div
          className="flex items-start gap-3 rounded-xl p-4 text-sm mb-4"
          style={{
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.22)',
            color: '#fbbf24',
          }}
        >
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h4 className="font-semibold text-amber-500">AI Features Inactive</h4>
            <p className="text-xs mt-0.5 text-amber-500/80">
              The AI Doubt Solver is disabled because the Gemini API key is missing. Set <code className="font-mono text-xs px-1 rounded bg-black/20">GEMINI_API_KEY</code> in your <code className="font-mono text-xs px-1 rounded bg-black/20">.env.local</code> file to enable this feature.
            </p>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl p-5 space-y-4"
        style={{ background: 'var(--ui-surface)', border: '1px solid var(--ui-border)' }}
      >
        <label htmlFor="question" className="text-xs font-semibold" style={{ color: 'var(--ui-muted)' }}>
          Your question
        </label>
        <textarea
          id="question"
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
            if (status !== 'idle') resetState();
          }}
          placeholder={isAiActive ? "e.g. Explain Kirchhoff's Voltage Law with a simple circuit example." : "AI Doubt Solver is disabled because GEMINI_API_KEY is not configured in the environment."}
          rows={5}
          disabled={!isAiActive}
          className="w-full rounded-xl px-4 py-3 text-sm resize-y outline-none transition-all duration-200"
          style={{
            background: 'var(--ui-surface)',
            border: isAiActive ? '1px solid rgba(110,231,216,0.15)' : '1px solid rgba(248,113,113,0.20)',
            color: isAiActive ? 'var(--ui-heading)' : 'var(--ui-muted)',
            lineHeight: 1.7,
            opacity: isAiActive ? 1 : 0.6,
            cursor: isAiActive ? 'text' : 'not-allowed',
          }}
          onFocus={e => {
            if (isAiActive) {
              e.currentTarget.style.borderColor = 'rgba(110,231,216,0.40)';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(110,231,216,0.07)';
            }
          }}
          onBlur={e => {
            if (isAiActive) {
              e.currentTarget.style.borderColor = 'rgba(110,231,216,0.15)';
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
        />

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="submit"
            disabled={!canSubmit || !isAiActive}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
            style={{
              background: canSubmit ? 'linear-gradient(135deg, #6EE7D8 0%, #14B8A6 100%)' : 'rgba(255,255,255,0.06)',
              color: canSubmit ? '#0d2420' : 'var(--ui-subtle)',
              boxShadow: canSubmit ? '0 4px 16px rgba(110,231,216,0.28)' : 'none',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
            onMouseEnter={e => {
              if (canSubmit) {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 22px rgba(110,231,216,0.44)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.boxShadow = canSubmit ? '0 4px 16px rgba(110,231,216,0.28)' : 'none';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            }}
          >
            {status === 'loading' ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Solving…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Get answer
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => { setQuestion(''); resetState(); }}
            disabled={!isAiActive}
            className="px-4 py-2.5 text-xs font-medium rounded-xl transition-colors duration-150"
            style={{
              background: 'rgba(110,231,216,0.05)',
              border: '1px solid rgba(110,231,216,0.14)',
              color: isAiActive ? '#0d9488' : 'var(--ui-subtle)',
              opacity: isAiActive ? 1 : 0.5,
              cursor: isAiActive ? 'pointer' : 'not-allowed',
            }}
            onMouseEnter={e => {
              if (isAiActive) {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(110,231,216,0.30)';
                (e.currentTarget as HTMLElement).style.background = 'rgba(110,231,216,0.09)';
              }
            }}
            onMouseLeave={e => {
              if (isAiActive) {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(110,231,216,0.14)';
                (e.currentTarget as HTMLElement).style.background = 'rgba(110,231,216,0.05)';
              }
            }}
          >
            Clear
          </button>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: 'var(--ui-muted)' }}>
            Try an example
          </p>
          <div className="flex flex-wrap gap-2">
            {exampleQuestions.map((q) => (
              <button
                key={q}
                type="button"
                disabled={!isAiActive}
                onClick={() => { setQuestion(q); if (status !== 'idle') resetState(); }}
                className="text-xs px-3 py-1.5 rounded-lg transition-all duration-150"
                style={{
                  background: 'var(--ui-surface-2)',
                  border: '1px solid var(--ui-border)',
                  color: 'var(--ui-muted)',
                  opacity: isAiActive ? 1 : 0.5,
                  cursor: isAiActive ? 'pointer' : 'not-allowed',
                }}
                onMouseEnter={e => {
                  if (isAiActive) {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(110,231,216,0.24)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--ui-heading)';
                  }
                }}
                onMouseLeave={e => {
                  if (isAiActive) {
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(110,231,216,0.10)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--ui-muted)';
                  }
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </form>

      <div
        className="rounded-2xl p-5 min-h-[200px] transition-all duration-300"
        style={{
          background: 'var(--ui-surface)',
          border: `1px solid ${status === 'success' ? 'rgba(110,231,216,0.22)' : status === 'error' ? 'rgba(248,113,113,0.22)' : 'rgba(110,231,216,0.12)'}`,
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--ui-heading)' }}>Answer</h2>
          {status === 'success' && (
            <span
              className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(110,231,216,0.08)', color: '#6EE7D8', border: '1px solid rgba(110,231,216,0.18)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#6EE7D8' }} />
              AI Response
            </span>
          )}
        </div>

        {status === 'idle' && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(110,231,216,0.08)', border: '1px solid rgba(110,231,216,0.14)' }}
            >
              <svg className="w-6 h-6" style={{ color: 'rgba(110,231,216,0.40)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--ui-muted)' }}>
              Ask a question to get your AI-powered answer
            </p>
          </div>
        )}

        {status === 'loading' && (
          <div className="space-y-3">
            <p className="text-sm font-medium" style={{ color: '#0f766e' }}>
              Thinking...
            </p>
            {['100%', '92%', '78%', '58%'].map((width, i) => (
              <div
                key={i}
                className="h-3 rounded-lg animate-pulse"
                style={{ width, background: 'rgba(110,231,216,0.16)' }}
              />
            ))}
            <div className="flex items-center gap-2 mt-4">
              <div className="w-4 h-4 rounded-full animate-pulse" style={{ background: 'rgba(110,231,216,0.20)' }} />
              <p className="text-xs" style={{ color: 'var(--ui-muted)' }}>EduFlow AI is preparing your answer...</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div
            className="flex items-start gap-3 rounded-xl p-4"
            style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.20)' }}
          >
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#f87171' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm" style={{ color: '#b91c1c' }}>{error ?? 'Failed to solve your doubt.'}</p>
          </div>
        )}

        {status === 'success' && result && (
          <div className="space-y-4">
            <div className="h-px w-full mb-4" style={{ background: 'linear-gradient(90deg, #6EE7D8, transparent)' }} />
            <div className="relative">
              <FormattedNote content={displayedAnswer} emptyText="" />
              {isTyping && (
                <span className="ml-1 animate-pulse text-sm" style={{ color: 'var(--ui-heading)' }}>
                  |
                </span>
              )}
            </div>
            {result.source && (
              <span
                className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(110,231,216,0.07)', color: '#6EE7D8', border: '1px solid rgba(110,231,216,0.16)' }}
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Source: {result.source}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
