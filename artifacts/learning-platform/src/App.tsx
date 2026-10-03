import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Link, Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import {
  ArrowRight, ArrowUpRight, BookOpen, BrainCircuit, Check, CheckCircle2,
  ChevronRight, CircleHelp, Clock3, Flame, GraduationCap, LayoutDashboard, ListChecks,
  LogOut, Moon, Search, Send, Sparkles, Sun, Target, TrendingUp, Trophy, type LucideIcon,
} from 'lucide-react';
import {
  getGetLearningDashboardQueryKey, getGetLearningRoadmapQueryKey,
  getListLearningCoursesQueryKey, getListCompetenciesQueryKey, getListLearningActivityQueryKey,
  useGetLearningDashboard, useListLearningCourses, useListCompetencies, useGetLearningRoadmap,
  useListLearningActivity, useUpdateCourseProgress, useAskLearningCoach,
} from '@workspace/api-client-react';
import type { Competency, LearningActivity, LearningCourse, RoadmapStep } from '@workspace/api-client-react';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#1d5547',
    colorForeground: '#21312c',
    colorMutedForeground: '#65716c',
    colorDanger: '#a95037',
    colorBackground: '#fffdf8',
    colorInput: '#fffdf8',
    colorInputForeground: '#21312c',
    colorNeutral: '#d8d2c3',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '1rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffdf8] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#21312c] font-bold',
    headerSubtitle: 'text-[#65716c]',
    socialButtonsBlockButtonText: 'text-[#21312c] font-semibold',
    formFieldLabel: 'text-[#21312c] font-semibold',
    footerActionLink: 'text-[#1d5547] font-semibold',
    footerActionText: 'text-[#65716c]',
    dividerText: 'text-[#65716c]',
    identityPreviewEditButton: 'text-[#1d5547]',
    formFieldSuccessText: 'text-[#226b57]',
    alertText: 'text-[#a95037]',
    logoBox: 'h-10',
    logoImage: 'h-10 w-auto',
    socialButtonsBlockButton: 'rounded-xl border-[#d8d2c3] bg-white',
    formButtonPrimary: 'rounded-xl bg-[#1d5547] text-white hover:bg-[#164638]',
    formFieldInput: 'rounded-xl border-[#d8d2c3] bg-white text-[#21312c]',
    footerAction: 'text-[#65716c]',
    dividerLine: 'bg-[#d8d2c3]',
    alert: 'rounded-xl border-[#a95037]/25 bg-[#a95037]/5',
    otpCodeFieldInput: 'rounded-lg border-[#d8d2c3] text-[#21312c]',
    formFieldRow: 'text-[#21312c]',
    main: 'text-[#21312c]',
  },
};
const navItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/courses', label: 'Course library', icon: BookOpen },
  { href: '/skills', label: 'Skill profile', icon: Target },
  { href: '/roadmap', label: 'Your roadmap', icon: ListChecks },
  { href: '/coach', label: 'Learning coach', icon: BrainCircuit },
];
const accents: Record<string, string> = {
  teal: 'bg-[#dcece5] text-[#226b57]', mint: 'bg-[#e4ebc9] text-[#586d25]',
  coral: 'bg-[#f6e1d8] text-[#a95037]', blue: 'bg-[#dce8ee] text-[#3d687b]',
  amber: 'bg-[#f3e8cb] text-[#8c6925]',
};
const accentStripe: Record<string, string> = {
  teal: 'from-[#286e5c] to-[#6d9b7d]', mint: 'from-[#667b35] to-[#a4ad65]',
  coral: 'from-[#b45c42] to-[#dc9975]', blue: 'from-[#46788c] to-[#8db4bd]',
  amber: 'from-[#a77c32] to-[#d1b36d]',
};
const initials = (name = 'Learner') => name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
const percent = (value: number) => `${Math.round(value)}%`;
const relativeDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
};

function LoadingPanel({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-3" aria-label="Loading">
    {Array.from({ length: rows }, (_, i) => <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-muted/75" />)}
  </div>;
}
function ErrorPanel({ retry }: { retry: () => void }) {
  return <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-6 text-center">
    <p className="font-semibold">We couldn’t load this just now.</p><p className="mt-1 text-sm text-muted-foreground">Your learning space is still here. Try again in a moment.</p>
    <button onClick={retry} data-testid="button-retry" className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Try again</button>
  </div>;
}
function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
    <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-secondary text-primary"><Sparkles size={19} /></span>
    <p className="mt-4 font-semibold">{title}</p><p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
  </div>;
}
function PanelTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return <div className="mb-4 flex items-end justify-between gap-3">
    <div>{eyebrow && <p className="mb-1 font-data text-[10px] uppercase tracking-[.18em] text-muted-foreground">{eyebrow}</p>}<h2 className="font-display text-xl font-bold tracking-[-.035em]">{title}</h2></div>
    {action}
  </div>;
}
function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return <div className={`h-2 overflow-hidden rounded-full bg-muted ${className}`}><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}
function CourseTile({ course, onProgress, busy = false, compact = false }: { course: LearningCourse; onProgress?: (course: LearningCourse) => void; busy?: boolean; compact?: boolean }) {
  const tone = accents[course.accent] ?? accents.teal;
  return <article data-testid={`card-course-${course.id}`} className="group overflow-hidden rounded-2xl border border-card-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-22px_hsl(var(--foreground)/.42)]">
    <div className={`relative flex h-[88px] items-end overflow-hidden bg-gradient-to-br ${accentStripe[course.accent] ?? accentStripe.teal} px-5 pb-3`}>
      <div className="absolute -right-2 -top-10 h-32 w-32 rounded-full border border-white/20" />
      <div className="absolute right-8 -top-8 h-24 w-24 rounded-full border border-white/20" />
      <span className="relative rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.15em] text-white backdrop-blur-sm">{course.category}</span>
      <span className="relative ml-auto font-data text-xs text-white/85">{course.durationHours}h</span>
    </div>
    <div className={compact ? 'p-4' : 'p-5'}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-[17px] font-bold leading-snug tracking-[-.025em]">{course.title}</h3>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${tone}`}>{course.level}</span>
      </div>
      {!compact && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{course.description}</p>}
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>{course.instructor}</span><span className="font-data">★ {Number(course.rating).toFixed(1)}</span></div>
      <div className="mt-4 flex items-center gap-3"><ProgressBar value={course.userProgress} className="flex-1" /><span className="font-data text-[11px] text-muted-foreground">{percent(course.userProgress)}</span></div>
      {onProgress && <button disabled={busy || course.userProgress >= 100} onClick={() => onProgress(course)} data-testid={`button-progress-${course.id}`} className="mt-4 flex w-full items-center justify-between rounded-xl bg-secondary px-3.5 py-2.5 text-sm font-semibold text-secondary-foreground transition hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">
        <span>{busy ? 'Saving progress…' : course.userProgress >= 100 ? 'Completed' : course.userProgress > 0 ? 'Continue learning' : 'Start course'}</span>{course.userProgress >= 100 ? <Check size={15} /> : <ArrowRight size={15} />}
      </button>}
    </div>
  </article>;
}
function ActivityRow({ item }: { item: LearningActivity }) {
  const isDone = item.kind.toLowerCase().includes('complete');
  return <div data-testid={`activity-${item.id}`} className="flex items-center gap-3 py-3.5">
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${isDone ? 'bg-[#e4ebc9] text-[#586d25] dark:bg-[#3c4727] dark:text-[#c4d58a]' : 'bg-[#dcece5] text-[#226b57] dark:bg-[#24483c] dark:text-[#a5d2bd]'}`}>{isDone ? <CheckCircle2 size={16} /> : <BookOpen size={16} />}</span>
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p><p className="truncate text-xs text-muted-foreground">{item.detail}</p></div>
    <span className="shrink-0 text-[11px] text-muted-foreground">{relativeDate(item.occurredAt)}</span>
  </div>;
}
function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const [dark, setDark] = useState(() => typeof window !== 'undefined' && localStorage.getItem('learning-theme') === 'dark');
  const dashboard = useGetLearningDashboard({ query: { queryKey: getGetLearningDashboardQueryKey() } });
  const learner = dashboard.data?.learner;
  const displayName = user?.fullName || user?.firstName || learner?.name || 'Learner';
  const toggleTheme = () => {
    const next = !dark; setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('learning-theme', next ? 'dark' : 'light');
  };
  if (typeof document !== 'undefined' && dark) document.documentElement.classList.add('dark');
  const current = navItems.find((item) => item.href === location);
  return <div className="grain min-h-[100dvh] bg-background text-foreground">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <Link href="/dashboard" className="flex items-center gap-3 px-7 py-7" data-testid="link-home">
        <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-sidebar-primary text-sidebar-primary-foreground"><GraduationCap size={22} /></span>
        <span><span className="block font-display text-[17px] font-extrabold tracking-[-.04em]">Fieldnote</span><span className="block text-[10px] font-semibold uppercase tracking-[.2em] text-sidebar-foreground/55">Learning studio</span></span>
      </Link>
      <div className="mx-5 mb-3 mt-5 font-data text-[9px] uppercase tracking-[.2em] text-sidebar-foreground/45">Your workspace</div>
      <nav className="space-y-1 px-3">
        {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`nav-${href === '/dashboard' ? 'overview' : href.slice(1)}`} className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-semibold transition-colors ${location === href ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`}>
          <Icon size={17} className={location === href ? 'text-sidebar-primary' : 'opacity-75'} /><span>{label}</span>{location === href && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />}
        </Link>)}
      </nav>
      <div className="mx-5 mt-auto mb-5 rounded-2xl border border-sidebar-border bg-sidebar-accent/55 p-4">
        <div className="flex items-center gap-2 text-sidebar-primary"><Sparkles size={15} /><span className="font-data text-[9px] uppercase tracking-[.17em]">A note for you</span></div>
        <p className="mt-2 text-xs leading-relaxed text-sidebar-foreground/75">Small, steady practice is what turns new skills into second nature.</p>
        <Link href="/coach" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-sidebar-primary" data-testid="link-coach-sidebar">Talk it through <ArrowRight size={13} /></Link>
      </div>
      <Link href="/account" className="flex items-center gap-3 border-t border-sidebar-border px-5 py-4 transition hover:bg-sidebar-accent/50" data-testid="link-account">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-[#d7e8d8] text-xs font-extrabold text-[#235b4b]">{initials(displayName)}</div>
        <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{displayName}</p><p className="truncate text-[10px] text-sidebar-foreground/55">{learner?.role ?? 'Learner'}</p></div>
      </Link>
    </aside>
    <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border/80 bg-background/90 px-4 backdrop-blur-md sm:px-7 lg:ml-[252px] lg:px-10">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground lg:hidden" data-testid="link-mobile-home"><GraduationCap size={20} /></Link>
        <span className="font-display text-sm font-bold lg:hidden">Fieldnote</span>
        <span className="hidden text-sm text-muted-foreground lg:inline">{current?.label ?? 'Learning space'}</span>
        <span className="hidden h-1 w-1 rounded-full bg-accent lg:inline-block" />
        <span className="hidden text-xs text-muted-foreground sm:inline">Your next chapter starts here.</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-1.5 rounded-full bg-secondary/75 px-3 py-1.5 text-xs font-semibold text-secondary-foreground sm:flex"><Flame size={14} className="text-[#bf6a44]" /> {learner?.streakDays ?? '—'} day streak</div>
        <Link href="/account" data-testid="link-mobile-account" aria-label="Account settings" className="grid h-9 w-9 place-items-center rounded-full bg-[#d7e8d8] text-xs font-extrabold text-[#235b4b] lg:hidden">{initials(displayName)}</Link>
        <button onClick={toggleTheme} data-testid="button-theme-toggle" aria-label="Toggle dark mode" className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground transition hover:text-foreground">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
        <button onClick={() => void signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out" aria-label="Sign out" title="Sign out" className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground transition hover:text-foreground"><LogOut size={16} /></button>
      </div>
    </header>
    <main className="px-4 pb-28 pt-7 sm:px-7 lg:ml-[252px] lg:px-10 lg:pb-12 lg:pt-9"><div className="mx-auto max-w-[1240px] page-enter">{children}</div></main>
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background/95 px-1 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur-lg lg:hidden">
      {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`mobile-nav-${href === '/dashboard' ? 'overview' : href.slice(1)}`} className={`flex flex-col items-center gap-1 py-1 text-[9px] font-semibold ${location === href ? 'text-primary' : 'text-muted-foreground'}`}><Icon size={18} /><span>{label === 'Course library' ? 'Courses' : label === 'Skill profile' ? 'Skills' : label === 'Your roadmap' ? 'Roadmap' : label === 'Learning coach' ? 'Coach' : 'Home'}</span></Link>)}
    </nav>
  </div>;
}

function DashboardPage() {
  const { user } = useUser();
  const query = useGetLearningDashboard({ query: { queryKey: getGetLearningDashboardQueryKey() } });
  const activity = useListLearningActivity({ query: { queryKey: getListLearningActivityQueryKey() } });
  const d = query.data;
  if (query.isLoading) return <><div className="mb-7 h-28 animate-pulse rounded-3xl bg-muted" /><LoadingPanel rows={4} /></>;
  if (query.isError || !d) return <ErrorPanel retry={() => void query.refetch()} />;
  const { learner, stats } = d;
  const displayName = user?.fullName || user?.firstName || learner.name;
  const firstName = user?.firstName || displayName.split(' ')[0];
  const week = d.weeklyHours ?? [];
  const maxWeek = Math.max(...week, 1);
  return <div className="space-y-8">
    <section className="relative overflow-hidden rounded-[28px] bg-[#1d5547] px-6 py-7 text-[#f4f1e6] sm:px-9 sm:py-9">
      <div className="absolute -right-16 -top-28 h-80 w-80 rounded-full border border-white/10" /><div className="absolute -right-3 -top-16 h-56 w-56 rounded-full border border-white/10" />
      <div className="relative grid gap-7 md:grid-cols-[1.3fr_.7fr] md:items-end">
        <div><p className="font-data text-[10px] uppercase tracking-[.2em] text-[#c5d995]">A good day to grow</p>
          <h1 data-testid="text-welcome" className="mt-3 max-w-xl font-display text-3xl font-extrabold leading-[1.08] tracking-[-.05em] sm:text-[42px]">You’re building a more capable <span className="text-[#c5d995]">you, {firstName}.</span></h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/70">{learner.role} · {learner.department}. Here’s the momentum you’ve made, and where to take it next.</p>
          <Link href="/roadmap" data-testid="link-view-roadmap" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#d5e4aa] px-4 py-2.5 text-sm font-bold text-[#1b493e] transition hover:-translate-y-0.5">Pick up your roadmap <ArrowRight size={15} /></Link>
        </div>
        <div className="relative flex items-center gap-4 rounded-2xl border border-white/15 bg-white/[.07] p-4 backdrop-blur-sm sm:p-5">
          <div className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full border-[5px] border-[#c5d995] text-center"><span className="font-data text-xl font-semibold">{stats.readinessScore}<small className="text-[10px]">%</small></span></div>
          <div><p className="font-display text-lg font-bold">Role readiness</p><p className="mt-1 text-xs leading-relaxed text-white/65">You’re closer than you think. Keep closing the highest-impact gaps.</p><Link href="/skills" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#d5e4aa]" data-testid="link-readiness-skills">See skill profile <ArrowRight size={12} /></Link></div>
        </div>
      </div>
    </section>
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {[
        { label: 'Learning hours', value: stats.learningHours, suffix: 'hrs', icon: Clock3, note: 'invested so far', change: 'up' },
        { label: 'Courses completed', value: stats.completedCourses, suffix: '', icon: Trophy, note: 'skills in your toolkit', change: 'up' },
        { label: 'In progress', value: stats.inProgressCourses, suffix: '', icon: BookOpen, note: 'one step at a time', change: 'flat' },
        { label: 'Weekly streak', value: learner.streakDays, suffix: 'days', icon: Flame, note: 'showing up matters', change: 'up' },
      ].map((item) => <div key={item.label} className="rounded-2xl border border-card-border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{item.label}</span><item.icon size={16} className="text-primary" /></div>
        <div className="mt-4 flex items-baseline gap-1.5"><span className="font-display text-3xl font-extrabold tracking-[-.06em]">{item.value}</span><span className="font-data text-[11px] text-muted-foreground">{item.suffix}</span></div>
        <p className="mt-1 text-[11px] text-muted-foreground">{item.note}</p>
      </div>)}
    </section>
    <section className="grid gap-6 xl:grid-cols-[1.55fr_.85fr]">
      <div>
        <PanelTitle eyebrow="A considered next step" title="Picked for your growth" action={<Link href="/courses" data-testid="link-all-courses" className="inline-flex items-center gap-1 text-xs font-bold text-primary">Explore all <ArrowRight size={13} /></Link>} />
        <div className="grid gap-4 md:grid-cols-2">{(d.recommendedCourses ?? []).slice(0, 2).map((course) => <CourseTile key={course.id} course={course} compact />)}</div>
      </div>
      <div className="rounded-2xl border border-card-border bg-card p-5">
        <PanelTitle eyebrow="Your rhythm" title="Hours this week" />
        <div className="flex h-[128px] items-end gap-2 pt-3">
          {week.map((hours, i) => <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="font-data text-[9px] text-muted-foreground">{hours}</span><div className={`w-full max-w-8 rounded-t-md transition-all duration-500 ${i === week.length - 1 ? 'bg-primary' : 'bg-[#cadcc6] dark:bg-[#526b55]'}`} style={{ height: `${Math.max(6, hours / maxWeek * 74)}%` }} /><span className="font-data text-[9px] text-muted-foreground">{['M','T','W','T','F','S','S'][i % 7]}</span></div>)}
        </div><div className="mt-4 flex items-center justify-between border-t border-border pt-3"><span className="text-xs text-muted-foreground">Time invested</span><span className="font-data text-sm font-semibold">{week.reduce((a, b) => a + b, 0).toFixed(1)} hrs</span></div>
      </div>
    </section>
    <section className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
      <div className="rounded-2xl border border-card-border bg-card p-5 sm:p-6">
        <PanelTitle eyebrow="Close the distance" title="Skills in motion" action={<Link href="/skills" data-testid="link-all-skills" className="inline-flex items-center gap-1 text-xs font-bold text-primary">All skills <ArrowRight size={13} /></Link>} />
        <div className="space-y-4">{(d.competencies ?? []).slice(0, 4).map((c) => <CompetencyBar key={c.id} competency={c} />)}</div>
      </div>
      <div className="rounded-2xl border border-card-border bg-card px-5 py-5">
        <PanelTitle eyebrow="The little wins add up" title="Recent activity" />
        {activity.isLoading ? <LoadingPanel rows={3} /> : activity.isError ? <ErrorPanel retry={() => void activity.refetch()} /> : (activity.data ?? d.activity ?? []).slice(0, 4).length ? <div className="divide-y divide-border">{(activity.data ?? d.activity ?? []).slice(0, 4).map((item) => <ActivityRow key={item.id} item={item} />)}</div> : <EmptyState title="Your first win is waiting" body="Start a course and it’ll show up here." />}
      </div>
    </section>
  </div>;
}

function CompetencyBar({ competency: c }: { competency: Competency }) {
  const ratio = c.targetLevel > 0 ? Math.min(100, c.currentLevel / c.targetLevel * 100) : 0;
  return <div data-testid={`competency-${c.id}`}>
    <div className="mb-2 flex items-center justify-between gap-4"><div className="min-w-0"><p className="truncate text-sm font-semibold">{c.name}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{c.category} <span className="mx-1">·</span><span className="capitalize">{c.impact} impact</span></p></div><span className="shrink-0 font-data text-[11px] text-muted-foreground">{c.currentLevel}<span className="mx-1 opacity-40">/</span>{c.targetLevel}</span></div>
    <div className="relative"><ProgressBar value={ratio} /><div className="absolute -top-[2px] h-3 w-[2px] bg-foreground/30" style={{ left: `${Math.min(100, c.targetLevel ? c.currentLevel / c.targetLevel * 100 : 0)}%` }} /></div>
  </div>;
}

function CoursesPage() {
  const query = useListLearningCourses({ query: { queryKey: getListLearningCoursesQueryKey() } });
  const client = useQueryClient();
  const progress = useUpdateCourseProgress();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All courses');
  const categories = ['All courses', ...new Set((query.data ?? []).map((c) => c.category))];
  const filtered = (query.data ?? []).filter((c) => `${c.title} ${c.category} ${c.description} ${c.instructor}`.toLowerCase().includes(search.toLowerCase()) && (category === 'All courses' || c.category === category));
  const advance = (course: LearningCourse) => {
    const next = Math.min(100, course.userProgress === 0 ? 12 : course.userProgress + 12);
    progress.mutate({ courseId: course.id, data: { percentComplete: next } }, { onSuccess: () => {
      void client.invalidateQueries({ queryKey: getGetLearningDashboardQueryKey() });
      void client.invalidateQueries({ queryKey: getListLearningCoursesQueryKey() });
      void client.invalidateQueries({ queryKey: getGetLearningRoadmapQueryKey() });
    } });
  };
  return <div className="space-y-7">
    <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="font-data text-[10px] uppercase tracking-[.2em] text-primary">The learning library</p><h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-.05em] sm:text-4xl">A skill you can use tomorrow.</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Practical courses selected to move your work forward, one useful idea at a time.</p></div><div className="rounded-xl bg-secondary/70 px-4 py-2 text-xs font-semibold text-secondary-foreground"><span className="font-data">{query.data?.length ?? '—'}</span> learning paths</div></section>
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <label className="flex h-11 items-center gap-3 rounded-xl border border-input bg-card px-3.5 md:w-[340px]"><Search size={16} className="text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-course-search" placeholder="Search courses, topics, instructors…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></label>
      <div className="flex gap-2 overflow-x-auto pb-1">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} data-testid={`filter-${item.toLowerCase().replace(/\s/g, '-')}`} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition ${category === item ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground hover:text-foreground'}`}>{item}</button>)}</div>
    </div>
    {query.isLoading ? <LoadingPanel rows={4} /> : query.isError ? <ErrorPanel retry={() => void query.refetch()} /> : filtered.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((course) => <CourseTile key={course.id} course={course} onProgress={advance} busy={progress.isPending && progress.variables?.courseId === course.id} />)}</div> : <EmptyState title={search ? 'No courses found' : 'Your library is taking shape'} body={search ? 'Try a different keyword or clear your filters.' : 'There are no courses to show just yet.'} />}
  </div>;
}

function SkillsPage() {
  const query = useListCompetencies({ query: { queryKey: getListCompetenciesQueryKey() } });
  const dashboard = useGetLearningDashboard({ query: { queryKey: getGetLearningDashboardQueryKey() } });
  const data = query.data;
  const sorted = [...(data ?? [])].sort((a, b) => {
    const impact = (x: string) => x.toLowerCase() === 'high' ? 0 : x.toLowerCase() === 'medium' ? 1 : 2;
    return impact(a.impact) - impact(b.impact) || (a.currentLevel / Math.max(1, a.targetLevel)) - (b.currentLevel / Math.max(1, b.targetLevel));
  });
  const gaps = sorted.filter((c) => c.currentLevel < c.targetLevel);
  return <div className="space-y-7">
    <section><p className="font-data text-[10px] uppercase tracking-[.2em] text-primary">Your capability map</p><h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-.05em] sm:text-4xl">See the distance. Make it smaller.</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">A clear view of what you already do well and which capabilities will create the biggest impact next.</p></section>
    {dashboard.data && <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center rounded-2xl bg-[#1d5547] px-5 py-5 text-[#f4f1e6] sm:px-7">
      <div><p className="font-data text-[10px] uppercase tracking-[.18em] text-[#c5d995]">Current role readiness</p><p className="mt-1 font-display text-2xl font-bold">{dashboard.data.stats.readinessScore}% <span className="text-sm font-medium text-white/65">of your target profile</span></p><p className="mt-1 text-xs text-white/65">{gaps.length} capabilities have room to grow.</p></div>
      <div className="h-16 w-16 rounded-full border-[5px] border-[#c5d995] p-[3px]"><div className="grid h-full place-items-center rounded-full bg-white/10 font-data text-xs">{dashboard.data.stats.readinessScore}</div></div>
    </div>}
    {query.isLoading ? <LoadingPanel rows={5} /> : query.isError ? <ErrorPanel retry={() => void query.refetch()} /> : sorted.length ? <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
      <section className="rounded-2xl border border-card-border bg-card p-5 sm:p-7"><PanelTitle eyebrow="Competency inventory" title={`${sorted.length} skills on your profile`} /><div className="space-y-6">{sorted.map((c) => <CompetencyBar key={c.id} competency={c} />)}</div></section>
      <aside className="space-y-4">
        <div className="rounded-2xl border border-card-border bg-card p-5"><div className="flex items-center gap-2 text-primary"><ArrowUpRight size={17} /><span className="font-data text-[10px] uppercase tracking-[.18em]">High-leverage gaps</span></div><h2 className="mt-2 font-display text-xl font-bold">Start here</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">These are the highest-impact capabilities with the most room to grow.</p>
          <div className="mt-4 space-y-2">{gaps.slice(0, 3).map((c) => <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/70 px-3 py-2.5"><span className="truncate text-xs font-semibold">{c.name}</span><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold uppercase ${c.impact.toLowerCase() === 'high' ? 'bg-[#f6e1d8] text-[#a95037] dark:bg-[#55372f] dark:text-[#f2ae92]' : 'bg-secondary text-secondary-foreground'}`}>{c.impact}</span></div>)}</div>
          <Link href="/roadmap" data-testid="link-skills-roadmap" className="mt-4 flex items-center justify-between rounded-xl bg-primary px-3.5 py-3 text-xs font-bold text-primary-foreground">See my learning plan <ArrowRight size={14} /></Link>
        </div>
        <div className="rounded-2xl border border-card-border bg-card p-5"><div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e4ebc9] text-[#586d25] dark:bg-[#3c4727] dark:text-[#c4d58a]"><TrendingUp size={17} /></span><div><p className="text-sm font-bold">Progress is a practice</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Competency levels are guideposts, not grades. Focus on one skill you can put to use this week.</p></div></div></div>
      </aside>
    </div> : <EmptyState title="Your skill profile is on its way" body="Once your competencies are assessed, you’ll see your strengths and growth opportunities here." />}
  </div>;
}

function RoadmapPage() {
  const query = useGetLearningRoadmap({ query: { queryKey: getGetLearningRoadmapQueryKey() } });
  const coursesQuery = useListLearningCourses({ query: { queryKey: getListLearningCoursesQueryKey() } });
  const client = useQueryClient();
  const progress = useUpdateCourseProgress();
  const courseMap = new Map((coursesQuery.data ?? []).map((course) => [course.id, course]));
  const steps = [...(query.data ?? [])].sort((a, b) => a.position - b.position);
  const complete = steps.filter((step) => step.status.toLowerCase() === 'completed').length;
  const advance = (step: RoadmapStep) => {
    const course = courseMap.get(step.courseId);
    if (!course) return;
    progress.mutate({ courseId: step.courseId, data: { percentComplete: Math.min(100, course.userProgress === 0 ? 12 : course.userProgress + 12) } }, { onSuccess: () => {
      void client.invalidateQueries({ queryKey: getGetLearningDashboardQueryKey() });
      void client.invalidateQueries({ queryKey: getListLearningCoursesQueryKey() });
      void client.invalidateQueries({ queryKey: getGetLearningRoadmapQueryKey() });
    } });
  };
  return <div className="space-y-7">
    <section><p className="font-data text-[10px] uppercase tracking-[.2em] text-primary">Your personalized sequence</p><h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-.05em] sm:text-4xl">A route, not a race.</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Each step builds on the last, connecting what you learn to the work you want to do.</p></section>
    {query.isLoading || coursesQuery.isLoading ? <LoadingPanel rows={4} /> : query.isError ? <ErrorPanel retry={() => void query.refetch()} /> : steps.length ? <>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-card-border bg-card px-5 py-4"><div><p className="font-display text-lg font-bold">Your progress so far</p><p className="mt-1 text-xs text-muted-foreground">Every completed step gives the next one more context.</p></div><div className="flex items-center gap-3"><div className="w-28"><ProgressBar value={steps.length ? complete / steps.length * 100 : 0} /></div><span className="font-data text-xs">{complete} / {steps.length}</span></div></div>
      <div className="relative ml-4 space-y-0 border-l border-border pl-7 sm:ml-8 sm:pl-10">
        {steps.map((step, i) => {
          const status = step.status.toLowerCase();
          const done = status === 'completed'; const active = status === 'in_progress' || status === 'in progress' || status === 'current';
          const course = courseMap.get(step.courseId);
          return <article key={step.id} data-testid={`roadmap-step-${step.id}`} className="relative pb-5 last:pb-0">
            <span className={`absolute -left-[38px] top-5 grid h-8 w-8 place-items-center rounded-full border-[3px] border-background font-data text-[10px] font-bold sm:-left-[51px] ${done ? 'bg-primary text-primary-foreground' : active ? 'bg-[#dcece5] text-primary ring-4 ring-[#dcece5]/50 dark:bg-[#24483c] dark:text-[#a5d2bd] dark:ring-[#24483c]/50' : 'bg-muted text-muted-foreground'}`}>{done ? <Check size={14} /> : String(i + 1).padStart(2, '0')}</span>
            <div className={`rounded-2xl border bg-card p-5 sm:p-6 ${active ? 'border-primary/45 shadow-[0_12px_30px_-24px_hsl(var(--primary)/.7)]' : 'border-card-border'}`}>
              <div className="flex flex-wrap items-center gap-2"><span className="font-data text-[9px] uppercase tracking-[.16em] text-muted-foreground">Step {String(i + 1).padStart(2, '0')}</span><span className="h-1 w-1 rounded-full bg-border" /><span className="text-[10px] font-semibold text-primary">{step.category}</span><span className={`ml-auto rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.08em] ${done ? 'bg-secondary text-secondary-foreground' : active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{done ? 'Completed' : active ? 'In progress' : 'Up next'}</span></div>
              <h2 className="mt-3 font-display text-xl font-bold tracking-[-.03em]">{step.title}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Clock3 size={13} /> About {step.estimatedHours} hours</span>{course && <span className="inline-flex items-center gap-1.5"><BookOpen size={13} /> {course.title}</span>}</div>
              {course && !done && <button onClick={() => advance(step)} disabled={progress.isPending} data-testid={`button-roadmap-progress-${step.id}`} className="mt-4 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-bold text-secondary-foreground transition hover:bg-primary hover:text-primary-foreground disabled:opacity-60">{progress.isPending ? 'Saving…' : course.userProgress ? 'Continue this step' : 'Begin this step'} <ArrowRight size={13} /></button>}
              {!course && <div className="mt-4 inline-flex items-center gap-1 text-[11px] text-muted-foreground"><CircleHelp size={13} /> Course details are being prepared</div>}
            </div>
          </article>;
        })}
      </div>
    </> : <EmptyState title="Your path is being mapped" body="Your personalized roadmap will appear here once your learning plan is ready." />}
  </div>;
}

type ChatMessage = { role: 'assistant' | 'user'; text: string };
function CoachPage() {
  const ask = useAskLearningCoach();
  const dashboard = useGetLearningDashboard({ query: { queryKey: getGetLearningDashboardQueryKey() } });
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', text: 'Hi — I’m here to help make your next learning step feel clear and doable. Ask me about a skill, your roadmap, or how to fit learning into a busy week.' }]);
  const suggestions = ['Which skill should I focus on first?', 'Help me make a realistic weekly plan', 'How can I use what I’m learning at work?'];
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (trimmed.length < 2 || ask.isPending) return;
    setMessages((current) => [...current, { role: 'user', text: trimmed }]);
    setQuestion('');
    const learnerContext = dashboard.data ? JSON.stringify({
      learner: dashboard.data.learner,
      stats: dashboard.data.stats,
      competencies: dashboard.data.competencies,
      recommendedCourses: dashboard.data.recommendedCourses?.map((c) => ({ title: c.title, category: c.category, progress: c.userProgress })),
      weeklyHours: dashboard.data.weeklyHours,
    }) : undefined;
    ask.mutate({ data: { question: trimmed, context: learnerContext } }, {
      onSuccess: (reply) => setMessages((current) => [...current, { role: 'assistant', text: reply.answer }]),
      onError: () => setMessages((current) => [...current, { role: 'assistant', text: 'I couldn’t reach your coach just now. Please try again in a moment.' }]),
    });
  };
  return <div className="mx-auto max-w-[1000px] space-y-7">
    <section><p className="font-data text-[10px] uppercase tracking-[.2em] text-primary">A thoughtful sounding board</p><h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-.05em] sm:text-4xl">Bring a question. Leave with a plan.</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Your coach uses your learning progress and skill profile to give advice that’s grounded in where you are.</p></section>
    <div className="grid gap-5 lg:grid-cols-[1fr_270px]">
      <section className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-card-border bg-card">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#dcece5] text-primary dark:bg-[#24483c]"><BrainCircuit size={20} /></span><div><p className="text-sm font-bold">Your learning coach</p><p className="text-[11px] text-muted-foreground">Here to help you find your next step</p></div><span className="ml-auto flex items-center gap-1.5 text-[10px] font-semibold text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Ready</span></div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6" aria-live="polite">{messages.map((message, i) => <div key={i} data-testid={`coach-message-${i}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === 'user' ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-muted text-foreground'}`}>{message.text}</div></div>)}
          {ask.isPending && <div className="flex justify-start"><div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-muted px-4 py-3 text-xs text-muted-foreground"><span className="flex gap-1"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:120ms]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:240ms]" /></span> Thinking through your learning data…</div></div>}
        </div>
        <form onSubmit={submit} className="border-t border-border p-3 sm:p-4"><div className="flex items-end gap-2 rounded-xl border border-input bg-background p-2">
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} data-testid="input-coach-question" placeholder="Ask about your learning…" rows={1} maxLength={2000} className="max-h-28 min-h-10 flex-1 resize-y bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground" />
          <button type="submit" disabled={question.trim().length < 2 || ask.isPending} data-testid="button-send-question" aria-label="Send question" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"><Send size={16} /></button>
        </div><p className="mt-2 px-1 text-[10px] text-muted-foreground">Enter to send · Shift + Enter for a new line</p></form>
      </section>
      <aside className="space-y-4">
        <div className="rounded-2xl border border-card-border bg-card p-5"><p className="font-data text-[10px] uppercase tracking-[.18em] text-muted-foreground">Try asking</p><div className="mt-3 space-y-2">{suggestions.map((suggestion, i) => <button key={suggestion} onClick={() => setQuestion(suggestion)} data-testid={`button-coach-suggestion-${i}`} className="w-full rounded-xl border border-border bg-background px-3.5 py-3 text-left text-xs font-semibold leading-relaxed transition hover:border-primary/50 hover:bg-secondary/50">{suggestion}<ChevronRight size={13} className="float-right mt-0.5 text-muted-foreground" /></button>)}</div></div>
        <div className="rounded-2xl bg-[#1d5547] p-5 text-[#f4f1e6]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-[#c5d995]"><Sparkles size={17} /></span><p className="mt-3 font-display text-lg font-bold">Better with context</p><p className="mt-1 text-xs leading-relaxed text-white/70">Your coach can draw on your skill profile, courses, and learning rhythm to keep its advice relevant.</p></div>
      </aside>
    </div>
  </div>;
}
function AccountPage() {
  const { user, isLoaded } = useUser();
  const dashboard = useGetLearningDashboard({ query: { queryKey: getGetLearningDashboardQueryKey() } });
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  if (!isLoaded || !user) return <LoadingPanel rows={2} />;
  if (dashboard.isLoading) return <LoadingPanel rows={2} />;
  if (dashboard.isError || !dashboard.data) return <ErrorPanel retry={() => void dashboard.refetch()} />;

  const copyUserId = () => {
    if (!navigator.clipboard) {
      setCopyState('failed');
      return;
    }
    void navigator.clipboard.writeText(user.id).then(
      () => setCopyState('copied'),
      () => setCopyState('failed'),
    );
  };

  return <div className="mx-auto max-w-3xl space-y-7">
    <section><p className="font-data text-[10px] uppercase tracking-[.2em] text-primary">Your profile</p><h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-.05em] sm:text-4xl">Account details</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Your learning progress is private to this signed-in account.</p></section>
    <section className="rounded-2xl border border-card-border bg-card p-5 sm:p-7">
      <div className="flex items-center gap-4 border-b border-border pb-5">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-[#d7e8d8] text-lg font-extrabold text-[#235b4b]">{initials(user.fullName || user.firstName || user.primaryEmailAddress?.emailAddress)}</div>
        <div className="min-w-0"><h2 className="truncate font-display text-xl font-bold">{user.fullName || user.firstName || 'Learner'}</h2><p className="truncate text-sm text-muted-foreground">{user.primaryEmailAddress?.emailAddress || 'Email not available'}</p></div>
      </div>
      <dl className="mt-5 grid gap-5 sm:grid-cols-2">
        <div><dt className="text-xs font-semibold text-muted-foreground">Access role</dt><dd className="mt-1 font-semibold">{dashboard.data.learner.role}</dd></div>
        <div><dt className="text-xs font-semibold text-muted-foreground">Account provider</dt><dd className="mt-1 font-semibold">Fieldnote secure sign-in</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs font-semibold text-muted-foreground">Account ID</dt><dd className="mt-1 break-all rounded-xl bg-muted/70 p-3 font-data text-xs">{user.id}</dd>
          <button type="button" onClick={copyUserId} className="mt-2 text-xs font-bold text-primary hover:underline">{copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Could not copy — select the ID above' : 'Copy account ID'}</button>
        </div>
      </dl>
      <p className="mt-5 rounded-xl bg-secondary/60 p-4 text-xs leading-relaxed text-secondary-foreground">Your account starts with learner access. Authorized roles are assigned by the learning platform administrator; they cannot be changed from this profile.</p>
    </section>
  </div>;
}

function PublicHome() {
  return <main className="grain min-h-[100dvh] bg-background text-foreground">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
      <a href={basePath || '/'} className="flex items-center gap-3" aria-label="Fieldnote home">
        <img src={`${basePath}/logo.svg`} alt="" className="h-10 w-10" />
        <span><span className="block font-display text-lg font-extrabold tracking-[-.04em]">Fieldnote</span><span className="block text-[9px] font-semibold uppercase tracking-[.2em] text-muted-foreground">Learning studio</span></span>
      </a>
      <div className="flex items-center gap-2 sm:gap-3">
        <Link href="/sign-in" className="rounded-full px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-secondary" data-testid="link-sign-in">Sign in</Link>
        <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90 sm:px-5" data-testid="link-sign-up">Create account <ArrowRight size={15} /></Link>
      </div>
    </header>
    <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-16 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
      <div>
        <p className="font-data text-[10px] uppercase tracking-[.22em] text-primary">A good day to grow</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-[1.03] tracking-[-.055em] sm:text-6xl">Learn what moves <span className="text-primary">you</span> forward.</h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">A clearer view of your skills, practical learning paths, and a coach to help you keep moving.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-full bg-[#1d5547] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#164638]" data-testid="link-get-started">Get started <ArrowRight size={16} /></Link>
          <Link href="/sign-in" className="rounded-full border border-border bg-card px-5 py-3 text-sm font-bold transition hover:bg-secondary" data-testid="link-existing-account">I already have an account</Link>
        </div>
        <p className="mt-5 text-xs text-muted-foreground">Your account keeps your progress private and available when you return.</p>
      </div>
      <div className="relative overflow-hidden rounded-[28px] bg-[#1d5547] p-5 text-[#f4f1e6] shadow-xl sm:p-7">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border border-white/10" /><div className="absolute -right-5 -top-12 h-44 w-44 rounded-full border border-white/10" />
        <div className="relative space-y-4">
          <div className="rounded-2xl border border-white/15 bg-white/[.07] p-5 backdrop-blur-sm">
            <p className="font-data text-[10px] uppercase tracking-[.18em] text-[#c5d995]">Your next chapter</p>
            <p className="mt-2 font-display text-2xl font-bold">Make growth feel possible.</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/70">See where you are today, then take one useful next step.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#d5e4aa] p-4 text-[#1b493e]"><Target size={18} /><p className="mt-4 text-sm font-bold">Know your strengths</p><p className="mt-1 text-xs leading-relaxed opacity-75">See skills and growth areas in one place.</p></div>
            <div className="rounded-2xl border border-white/15 bg-white/[.07] p-4"><BookOpen size={18} className="text-[#c5d995]" /><p className="mt-4 text-sm font-bold">Learn with purpose</p><p className="mt-1 text-xs leading-relaxed text-white/70">Follow a roadmap and track your progress.</p></div>
          </div>
        </div>
      </div>
    </section>
    <footer className="mx-auto max-w-7xl px-5 pb-7 text-xs text-muted-foreground sm:px-8">Fieldnote · A calmer way to keep learning.</footer>
  </main>;
}

function AuthLoading() {
  return <div className="grid min-h-[100dvh] place-items-center bg-background"><div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground"><img src={`${basePath}/logo.svg`} alt="" className="h-9 w-9" />Loading your secure learning space…</div></div>;
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  return isSignedIn ? <Redirect to="/dashboard" /> : <PublicHome />;
}

function SignInPage() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>;
}

function SignUpPage() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>;
}

function ProtectedWorkspace() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  if (!isSignedIn) return <Redirect to="/" />;
  return <AppShell><RoutedErrorBoundary><Switch>
    <Route path="/dashboard" component={DashboardPage} />
    <Route path="/courses" component={CoursesPage} />
    <Route path="/skills" component={SkillsPage} />
    <Route path="/roadmap" component={RoadmapPage} />
    <Route path="/coach" component={CoachPage} />
    <Route path="/account" component={AccountPage} />
    <Route component={NotFound} />
  </Switch></RoutedErrorBoundary></AppShell>;
}

function Router() {
  return <Switch>
    <Route path="/sign-in/*?" component={SignInPage} />
    <Route path="/sign-up/*?" component={SignUpPage} />
    <Route path="/" component={HomeRedirect} />
    <Route component={ProtectedWorkspace} />
  </Switch>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const currentQueryClient = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previousUserId.current !== undefined && previousUserId.current !== userId) {
        currentQueryClient.clear();
      }
      previousUserId.current = userId;
    });
    return unsubscribe;
  }, [addListener, currentQueryClient]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to access your learning space' } },
      signUp: { start: { title: 'Create your account', subtitle: 'Start building your next skill' } },
    }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}>
      <ClerkQueryClientCacheInvalidator />
      <TooltipProvider><Router /><Toaster /></TooltipProvider>
    </QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY.');
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}
export default App;