'use client';

import Link from 'next/link';
import Image from 'next/image';

const features = [
  { icon: '📚', label: 'Study Planner' },
  { icon: '🤖', label: 'AI Doubt Solver' },
  { icon: '📝', label: 'Notes Generator' },
  { icon: '📊', label: 'Productivity Tracker' },
  { icon: '😊', label: 'Mood Tracker' },
  { icon: '🎯', label: 'AI Study Plan'}
];

export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden lg:min-h-[min(100vh,980px)] flex flex-col pt-[60px] lg:pt-0" style={{ background: 'var(--ui-bg)' }}>
      {/* Mobile Image (shown only on mobile) */}
      <div className="relative w-full h-[250px] sm:h-[350px] lg:hidden flex-shrink-0">
        <Image
          src="/images/hero1.jpg"
          alt="EduFlow AI hero image"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover object-center"
        />
      </div>

      {/* Desktop Background Image & Overlays (shown only on desktop) */}
      <div className="absolute inset-0 hidden lg:block">
        <Image
          src="/images/hero.jpg"
          alt="EduFlow AI hero background"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 100vw"
          className="object-cover object-center"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(252,252,249,0.98) 0%, rgba(252,252,249,0.92) 32%, rgba(252,252,249,0.58) 48%, rgba(252,252,249,0.12) 66%, rgba(252,252,249,0.02) 100%)',
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 hidden dark:block"
          style={{
            background:
              'linear-gradient(90deg, rgba(2,6,23,0.86) 0%, rgba(2,6,23,0.76) 34%, rgba(2,6,23,0.54) 58%, rgba(2,6,23,0.20) 74%, rgba(2,6,23,0.08) 100%)',
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-y-0 left-0 w-full lg:w-[62%]"
          style={{
            background:
              'linear-gradient(90deg, rgba(252,252,249,0.98) 0%, rgba(252,252,249,0.94) 38%, rgba(252,252,249,0.78) 64%, rgba(252,252,249,0.12) 100%)',
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-y-0 left-0 w-full lg:w-[48%] opacity-70"
          style={{
            background:
              'radial-gradient(circle at 18% 42%, rgba(110,231,216,0.22) 0%, rgba(110,231,216,0.12) 26%, rgba(110,231,216,0.02) 54%, rgba(110,231,216,0) 72%)',
          }}
          aria-hidden="true"
        />
      </div>

      <div className="relative mx-auto flex flex-col lg:flex-row lg:items-center lg:min-h-[min(100vh,980px)] w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-8 lg:py-24">
        {/* <div className="relative z-10 max-w-2xl rounded-[32px] border border-white/40 bg-white/55 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur-[10px] sm:p-8 lg:max-w-[46%] lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-0"> */}
        <div className="relative z-10 max-w-2xl rounded-[32px] border border-white/20 bg-black/20 backdrop-blur-xl p-6 shadow-[0_20px_70px_rgba(15,23,42,0.25)] sm:p-8 lg:max-w-[46%]">
          <div
            className="mb-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold"
            style={{ background: 'var(--ui-surface-2)', border: '1px solid var(--ui-border)', color: '#14b8a6' }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#6ee7d8' }} />
            Premium student workspace
          </div>

          <h1
            className="mb-6 font-extrabold leading-[1.05] tracking-tight"
            style={{ fontSize: 'clamp(2.4rem, 6vw, 4.5rem)', color: 'var(--ui-heading)', letterSpacing: '-0.02em' }}
          >
            Study with clarity.
            <br />
            Grow with flow.
          </h1>

          <p
            className="mb-8 max-w-lg leading-relaxed"
            style={{ fontSize: 'clamp(1rem, 1.8vw, 1.12rem)', color: 'var(--ui-subtle)' }}
          >
            EduFlow AI brings your planning, doubt solving, notes, and productivity habits
            into one beautifully organized space built for modern students.
          </p>

          <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-sm font-bold transition-all duration-200"
              style={{ background: '#14b8a6', color: '#ffffff', boxShadow: '0 10px 22px rgba(20,184,166,0.22)' }}
            >
              Start Learning Free
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M5 12h14m-7-7l7 7-7 7" />
              </svg>
            </Link>

            <Link
              href="/#features"
              className="inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold transition-colors duration-200"
              style={{ color: 'var(--ui-heading)', border: '1px solid var(--ui-border)', background: 'var(--ui-surface)' }}
            >
              Explore features
            </Link>
          </div>

          <p className="text-sm" style={{ color: 'var(--ui-subtle)' }}>
            Trusted by students who want consistent, focused progress.
          </p>

          <div className="mt-8 flex flex-wrap gap-2.5">
            {features.map(f => (
              <span
                key={f.label}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs"
                style={{ background: 'var(--ui-surface)', border: '1px solid var(--ui-border)', color: 'var(--ui-muted)' }}
              >
                <span>{f.icon}</span>
                {f.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
