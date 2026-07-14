'use client';

import Link from 'next/link';
import { useState } from 'react';
import MeshBackground from '@/components/ui/MeshBackground';
import {
  Sparkles, ArrowRight, Shield, Zap, Smartphone, Users,
  PieChart, WifiOff, ChevronDown, Check, Star,
} from 'lucide-react';

const steps = [
  { num: '01', title: 'Create an Account', body: 'Sign up in seconds with your email. Completely free — no credit card needed.', color: 'from-violet-500 to-fuchsia-500' },
  { num: '02', title: 'Create a Group', body: 'Make a group for your trip, household, or friends. Invite members instantly.', color: 'from-cyan-500 to-blue-500' },
  { num: '03', title: 'Add Expenses', body: 'Log shared expenses. Split equally, by exact amounts, or custom percentages.', color: 'from-amber-500 to-orange-500' },
  { num: '04', title: 'Settle Up', body: 'Our algorithm finds the minimum payments needed to settle every debt fairly.', color: 'from-lime-500 to-emerald-500' },
];

const features = [
  { icon: PieChart, title: 'Smart Splits', body: 'Equal, exact, or percentage splits with live validation.', color: 'widget-violet', iconColor: 'text-violet-300' },
  { icon: WifiOff, title: 'Works Offline', body: 'Cached locally — view balances even without signal.', color: 'widget-cyan', iconColor: 'text-cyan-300' },
  { icon: Users, title: 'Group Stats', body: 'See each member\'s net balance at a glance.', color: 'widget-fuchsia', iconColor: 'text-fuchsia-300' },
  { icon: Shield, title: 'Secure', body: 'Supabase SSR with Row Level Security on every table.', color: 'widget-lime', iconColor: 'text-lime-300' },
  { icon: Zap, title: 'Instant Updates', body: 'Dashboard recalculates instantly — no refresh needed.', color: 'widget-amber', iconColor: 'text-amber-300' },
  { icon: Smartphone, title: 'Install as PWA', body: 'Add to home screen for a native app experience.', color: 'widget-rose', iconColor: 'text-rose-300' },
];

const faqs = [
  { q: 'Is it free?', a: 'Yes, completely free. No hidden fees, premium tiers, or ads.' },
  { q: 'How does debt minimization work?', a: 'We use a greedy algorithm to find the minimum number of transactions that settle all balances at once.' },
  { q: 'Can I use it offline?', a: 'Yes. Your data is saved to localStorage and works without connection.' },
  { q: 'Can I be in multiple groups?', a: 'Absolutely — separate groups for apartment, travel, office lunches, etc.' },
  { q: 'Is my data private?', a: 'All data is stored in Supabase with RLS. Only group members can view expenses.' },
];

function FAQItem({ q, a, idx }: { q: string; a: string; idx: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`widget overflow-hidden transition-all duration-300 animate-fade-in-up ${open ? 'widget-violet' : ''}`}
      style={{ animationDelay: `${idx * 60}ms`, opacity: 0 }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-4 md:px-5 md:py-4 text-left gap-4">
        <span className="text-sm font-bold text-white">{q}</span>
        <ChevronDown size={18} className={`text-violet-300 shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
        <p className="px-4 pb-4 md:px-5 md:pb-5 text-sm text-white/50 leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen text-white overflow-x-hidden relative">
      <MeshBackground />

      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/8">
        <div className="landing-container h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 animate-fade-in-up hover:opacity-90 transition-opacity">
            <span className="icon-badge bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30">
              <Sparkles size={16} className="text-white" />
            </span>
            <span className="font-extrabold text-lg gradient-text">Splitwise</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-white/50 font-semibold">
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-white/50 hover:text-white font-semibold px-3 py-1.5 transition-colors">
              Sign In
            </Link>
            <Link href="/login" className="btn-gradient flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl">
              Get Started <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative landing-container pt-16 pb-16 md:pt-24 md:pb-20 text-center z-10">
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 glass-light border border-violet-500/30 text-violet-200 text-xs font-extrabold rounded-full mb-8 animate-fade-in-up">
          <Star size={12} className="text-amber-300" /> Free · PWA Ready · Open Source
        </span>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05] max-w-3xl mx-auto animate-fade-in-up delay-1">
          Split expenses{' '}
          <span className="gradient-text-warm">without the drama.</span>
        </h1>

        <p className="mt-6 text-lg text-white/50 max-w-xl mx-auto leading-relaxed font-medium animate-fade-in-up delay-2">
          Add shared expenses, split any way you want, and let our smart algorithm settle every debt with minimum payments.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center animate-fade-in-up delay-3">
          <Link href="/login" className="btn-gradient flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-sm font-extrabold">
            Start for free <ArrowRight size={16} />
          </Link>
          <Link href="/login" className="flex items-center justify-center px-8 py-4 glass-light border border-white/10 hover:border-violet-500/40 text-white font-bold rounded-2xl transition-all text-sm">
            Sign In
          </Link>
        </div>

        <div className="mt-14 flex flex-wrap justify-center gap-6 text-sm text-white/40 animate-fade-in-up delay-4">
          {['No credit card', 'Works offline', 'Row-Level Security'].map((t) => (
            <span key={t} className="flex items-center gap-1.5 font-semibold">
              <Check size={14} className="text-lime-400" /> {t}
            </span>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="relative landing-container landing-section scroll-mt-20 z-10">
        <div className="text-center mb-10 md:mb-12 max-w-3xl mx-auto">
          <p className="text-xs font-extrabold text-violet-300 uppercase tracking-widest mb-2">How it works</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white">Settled in minutes.</h2>
        </div>
        <div className="grid md:grid-cols-2 grid-cards max-w-5xl mx-auto">
          {steps.map((s, idx) => (
            <div key={s.num} className="widget animate-fade-in-up hover:scale-[1.01] transition-transform"
              style={{ animationDelay: `${idx * 80}ms`, opacity: 0 }}>
              <div className="flex gap-4">
                <span className={`text-2xl font-extrabold bg-gradient-to-br ${s.color} bg-clip-text text-transparent shrink-0`}>{s.num}</span>
                <div>
                  <h3 className="font-extrabold text-white mb-1.5">{s.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{s.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative landing-container landing-section scroll-mt-20 z-10">
        <div className="text-center mb-10 md:mb-12 max-w-3xl mx-auto">
          <p className="text-xs font-extrabold text-fuchsia-300 uppercase tracking-widest mb-2">Features</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white">Everything you need.</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 grid-cards max-w-5xl mx-auto">
          {features.map(({ icon: Icon, title, body, color, iconColor }, idx) => (
            <div key={title} className={`widget ${color} animate-fade-in-up`}
              style={{ animationDelay: `${idx * 60}ms`, opacity: 0 }}>
              <span className={`inline-flex p-3 rounded-xl glass-light border border-white/10 ${iconColor} mb-4`}>
                <Icon size={22} />
              </span>
              <h3 className="font-extrabold text-white mb-1.5">{title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative landing-container landing-section scroll-mt-20 z-10 max-w-3xl">
        <div className="text-center mb-10 md:mb-12">
          <p className="text-xs font-extrabold text-cyan-300 uppercase tracking-widest mb-2">FAQ</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white">Common questions.</h2>
        </div>
        <div className="card-list">
          {faqs.map((f, idx) => <FAQItem key={f.q} q={f.q} a={f.a} idx={idx} />)}
        </div>
      </section>

      {/* CTA */}
      <section className="relative landing-container pb-16 md:pb-24 pt-4 z-10 max-w-5xl">
        <div className="widget widget-violet overflow-hidden widget-lg text-center relative">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-cyan-500/10 animate-gradient pointer-events-none" />
          <h2 className="text-3xl font-extrabold text-white mb-3 relative">Ready to split fairly?</h2>
          <p className="text-white/50 mb-7 relative font-medium">Create a group and add your first expense in under 60 seconds.</p>
          <Link href="/login" className="btn-gradient inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-extrabold relative">
            Get Started — It&apos;s Free <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/8 py-8 md:py-10 text-center text-xs text-white/30 font-medium landing-container">
        <p>© 2026 Splitwise · Next.js & Supabase</p>
      </footer>
    </div>
  );
}
