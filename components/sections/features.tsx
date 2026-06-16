'use client';

import Link from 'next/link';
import React from 'react';

const features = [
  {
    title: 'Weekly Timetable',
    details:
      'Stay on top of your schedule with a dynamic weekly timetable that maps out your classes, study sessions, and breaks seamlessly.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    accent: '#6EE7D8',
    accentBg: 'rgba(110,231,216,0.10)',
    tag: 'Planning',
    href: '/dashboard/timetable',
  },
  {
    title: 'Study Rooms',
    details:
      'Join virtual, focus-driven study rooms to collaborate with peers, share resources, and stay accountable in real time.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    accent: '#14B8A6',
    accentBg: 'rgba(20,184,166,0.10)',
    tag: 'Collaboration',
    href: '/dashboard/study-rooms',
  },
  {
    title: 'AI Recommender',
    details:
      'Receive personalized study suggestions, smart resource recommendations, and tailored paths based on your learning habits.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    accent: '#5EEAD4',
    accentBg: 'rgba(94,234,212,0.10)',
    tag: 'AI-Powered',
    href: '/dashboard/ai-recommender',
  },
  {
    title: 'Productivity Tracker',
    details:
      'Visualise your focus time, streaks, and completion rates. Stay consistent with gentle nudges and weekly insights.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    accent: '#6EE7D8',
    accentBg: 'rgba(110,231,216,0.08)',
    tag: 'Insights',
    href: '/dashboard/productivity',
  },
  {
    title: 'Mood Tracker',
    details:
      'Track your daily mood, reflect on patterns, and build healthier study habits with simple emotional check-ins.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    accent: '#14B8A6',
    accentBg: 'rgba(20,184,166,0.08)',
    tag: 'Wellness',
    href: '/dashboard/mood',
  },
  {
    title: 'Weekly Productivity Graph',
    details:
      'Monitor your progress with beautifully rendered visual analytics. Track trends, analyze focus hours, and stay completely consistent.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} 
          d="M7 12l3-3 3 3 4-4M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    accent: '#5EEAD4',
    accentBg: 'rgba(94,234,212,0.10)',
    tag: 'Analytics',
    href: '/dashboard/productivity',
  },
];

export default function Features() {
  return (
    <section
      id="features"
      className="relative py-32 overflow-hidden"
      style={{ background: 'var(--ui-surface-2)' }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(20,184,166,0.06) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
          opacity: 0.35,
        }}
      />
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(20,184,166,0.2), transparent)' }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse 65% 45% at 50% 0%, rgba(196,181,253,0.18) 0%, transparent 70%)',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">

        <div className="text-center mb-20">
          <div
            className="inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-5"
            style={{
              background: 'var(--ui-surface)',
              color: '#14b8a6',
              border: '1px solid var(--ui-border)',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#6ee7d8' }} />
            Six tools. One workspace.
          </div>

          <h2
            className="font-bold tracking-tight mb-4"
            style={{
              fontSize: 'clamp(2rem, 4.5vw, 3rem)',
              color: 'var(--ui-heading)',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            Everything a student needs{' '}
            <br className="hidden sm:block" />
            to{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #14b8a6, #6ee7d8)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              actually excel
            </span>
          </h2>

          <p
            className="max-w-xl mx-auto leading-relaxed"
            style={{ fontSize: '1.0625rem', color: 'var(--ui-muted)' }}
          >
            No switching apps. No friction. Just one beautifully designed space that
            keeps you organised, focused, and one step ahead.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(f => <FeatureCard key={f.title} {...f} />)}
        </div>

      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(20,184,166,0.15), transparent)' }}
        aria-hidden="true"
      />
    </section>
  );
}

type CardProps = {
  title: string;
  details: string;
  icon: React.ReactNode;
  accent: string;
  accentBg: string;
  tag: string;
  href: string;
};

function FeatureCard({ title, details, icon, accent, accentBg, tag, href }: CardProps) {
  return (
    <Link href={href} className="block focus:outline-none group">
      <div
        className="relative rounded-2xl p-6 h-full flex flex-col gap-4 transition-all duration-250 overflow-hidden dark:bg-slate-900/80 dark:border-slate-700"
        style={{
          background: 'var(--ui-surface)',
          border: '1px solid var(--ui-border)',
          boxShadow: '0 10px 25px rgba(31,41,55,0.05)',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = `${accent}55`;
          el.style.boxShadow = `0 16px 30px rgba(31,41,55,0.11), 0 0 0 1px ${accent}20`;
          el.style.transform = 'translateY(-4px)';
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = 'var(--ui-border)';
          el.style.boxShadow = '0 10px 25px rgba(31,41,55,0.05)';
          el.style.transform = 'translateY(0)';
        }}
      >
        <div
          className="absolute -top-16 -right-16 w-32 h-32 rounded-full blur-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: `${accent}24` }}
          aria-hidden="true"
        />

        <div className="flex items-start justify-between">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: accentBg, color: accent, border: `1px solid ${accent}2f` }}
          >
            {icon}
          </div>
          <span
            className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
            style={{
              background: 'var(--ui-surface-2)',
              color: accent,
              border: `1px solid ${accent}36`,
            }}
          >
            {tag}
          </span>
        </div>

        <div className="flex-1 flex flex-col gap-2">
          <h3
            className="text-[15px] font-semibold leading-snug"
            style={{ color: 'var(--ui-heading)' }}
          >
            {title}
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--ui-muted)' }}>
            {details}
          </p>
        </div>

        <div className="flex items-center gap-1.5 mt-auto">
          <div
            className="h-px flex-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-250"
            style={{ background: `linear-gradient(90deg, ${accent}55, transparent)` }}
          ></div>
          <span
            className="text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1"
            style={{ color: accent }}
          >
            Open tool
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14m-7-7l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}