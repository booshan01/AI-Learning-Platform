import { useEffect, useMemo, useRef, useState } from "react";
import { useUser, useClerk } from "@clerk/react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/lib/theme-context";
import PersonalDetailsForm from "@/components/personal-details-form";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react";
import {
  getGetLearningDashboardQueryKey,
  getGetLearningSettingsQueryKey,
  useGetLearningDashboard,
  useGetLearningSettings,
  useUpdateLearningSettings,
} from "@workspace/api-client-react";

type CoachStyle = "supportive" | "concise" | "challenging";
const coachOptions: {
  value: CoachStyle;
  title: string;
  description: string;
  sample: string;
}[] = [
  {
    value: "supportive",
    title: "Supportive",
    description: "Encouraging, patient, and focused on building momentum.",
    sample: "“You’ve got this. Let’s find one small next step.”",
  },
  {
    value: "concise",
    title: "Concise",
    description: "Direct answers, clear priorities, no extra detours.",
    sample: "“Start with the lesson on stakeholder interviews.”",
  },
  {
    value: "challenging",
    title: "Challenging",
    description: "Thoughtful questions that stretch your thinking.",
    sample: "“What evidence would change your current approach?”",
  },
];

function initials(name?: string | null) {
  if (!name) return "L";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { mode, setMode } = useTheme();
  const queryClient = useQueryClient();
  const settingsQuery = useGetLearningSettings({
    query: { queryKey: getGetLearningSettingsQueryKey() },
  });
  const dashboardQuery = useGetLearningDashboard({
    query: { queryKey: getGetLearningDashboardQueryKey() },
  });
  const updateSettings = useUpdateLearningSettings();

  const [goalHours, setGoalHours] = useState(5);
  const [coachStyle, setCoachStyle] = useState<CoachStyle>("supportive");
  const [savedMessage, setSavedMessage] = useState("");
  const [themeMessage, setThemeMessage] = useState("");
  const initialized = useRef(false);
  const loadedTheme = mode;

  useEffect(() => {
    if (!settingsQuery.data || initialized.current) return;
    initialized.current = true;
    setGoalHours(settingsQuery.data.weeklyStudyGoalHours ?? 5);
    setCoachStyle(settingsQuery.data.coachStyle ?? "supportive");
  }, [settingsQuery.data]);

  const storedGoal = settingsQuery.data?.weeklyStudyGoalHours ?? 5;
  const storedCoach = (settingsQuery.data?.coachStyle ?? "supportive") as CoachStyle;
  const isDirty =
    initialized.current &&
    (goalHours !== storedGoal || coachStyle !== storedCoach);

  const weeklyHours = useMemo(
    () => dashboardQuery.data?.weeklyHours ?? [],
    [dashboardQuery.data?.weeklyHours],
  );
  const weeklyTotal = weeklyHours.reduce((sum, hours) => sum + hours, 0);
  const displayName =
    user?.fullName || user?.firstName || user?.primaryEmailAddress?.emailAddress;
  const email = user?.primaryEmailAddress?.emailAddress;

  const changeTheme = (nextMode: "light" | "dark") => {
    setThemeMessage("");
    setMode(nextMode);
  };

  const savePreferences = () => {
    setSavedMessage("");
    updateSettings.mutate(
      { data: { weeklyStudyGoalHours: goalHours, coachStyle } },
      {
        onSuccess: (result) => {
          queryClient.setQueryData(getGetLearningSettingsQueryKey(), result);
          setSavedMessage("Your learning preferences are saved.");
        },
        onError: () => setSavedMessage("Couldn’t save just now. Please try again."),
      },
    );
  };

  const handleThemeSelect = (nextMode: "light" | "dark") => {
    if (nextMode === loadedTheme) return;
    changeTheme(nextMode);
    setThemeMessage(`Appearance set to ${nextMode} mode.`);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-8">
      <header className="relative overflow-hidden rounded-[28px] border border-card-border bg-card px-6 py-7 sm:px-9 sm:py-9">
        <div
          aria-hidden="true"
          className="absolute -right-12 -top-20 h-64 w-64 rounded-full border-[1px] border-primary/10"
        />
        <div
          aria-hidden="true"
          className="absolute -right-1 top-8 h-36 w-36 rounded-full border border-primary/10"
        />
        <div className="relative max-w-2xl">
          <p className="font-data text-[10px] font-semibold uppercase tracking-[.2em] text-primary">
            Your workspace
          </p>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-[-.055em] sm:text-[42px]">
            Settings
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
            Shape a learning rhythm that fits your work, and make Fieldnote feel
            like your own.
          </p>
        </div>
        <div className="relative mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/80 pt-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck size={14} className="text-primary" />
            Private to your signed-in account
          </span>
          {dashboardQuery.data?.learner?.role && (
            <span
              className="inline-flex items-center gap-2"
              data-testid="text-learner-role"
            >
              <span className="h-1 w-1 rounded-full bg-accent" />
              {dashboardQuery.data.learner.role}
            </span>
          )}
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <main className="space-y-6">
          <section
            aria-labelledby="appearance-heading"
            className="rounded-[24px] border border-card-border bg-card p-5 sm:p-7"
            data-testid="section-appearance"
          >
            <div className="flex items-start gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
                <Sun size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2
                    id="appearance-heading"
                    className="font-display text-xl font-bold tracking-[-.035em]"
                  >
                    Appearance
                  </h2>
                  <span className="font-data text-[9px] uppercase tracking-[.14em] text-muted-foreground">
                    Applies across Fieldnote
                  </span>
                </div>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  Choose the atmosphere you’d like to learn in.
                </p>
                <div
                  className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3"
                  role="radiogroup"
                  aria-label="Appearance mode"
                >
                  {(
                    [
                      { value: "light", label: "Light", Icon: Sun },
                      { value: "dark", label: "Dark", Icon: Moon },
                    ] as const
                  ).map(({ value, label, Icon }) => {
                    const selected = loadedTheme === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={`${label} appearance`}
                        data-testid={`button-theme-${value}`}
                        onClick={() => handleThemeSelect(value)}
                        className={`group flex min-h-[76px] items-center gap-3 rounded-2xl border px-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
                          selected
                            ? "border-primary bg-primary/[.07] text-foreground"
                            : "border-border bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        <span
                          className={`grid h-9 w-9 place-items-center rounded-xl ${
                            selected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Icon size={17} />
                        </span>
                        <span className="flex-1">
                          <span className="block text-sm font-bold">{label}</span>
                          <span className="mt-0.5 block text-[11px]">
                            {value === "light"
                              ? "Soft and clear"
                              : "Low-light focus"}
                          </span>
                        </span>
                        {selected && (
                          <Check size={15} className="text-primary" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <p
                  aria-live="polite"
                  className="mt-3 min-h-4 text-xs text-muted-foreground"
                  data-testid="status-theme"
                >
                  {themeMessage}
                </p>
              </div>
            </div>
          </section>

          <section
            aria-labelledby="learning-heading"
            className="rounded-[24px] border border-card-border bg-card p-5 sm:p-7"
            data-testid="section-learning-preferences"
          >
            <div className="flex items-start gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#f5e7d8] text-[#8b5534] dark:bg-[#453428] dark:text-[#efb58b]">
                <Clock3 size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2
                    id="learning-heading"
                    className="font-display text-xl font-bold tracking-[-.035em]"
                  >
                    Learning preferences
                  </h2>
                  {settingsQuery.data && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-primary">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Preferences loaded
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  Small commitments are easier to keep than perfect plans.
                </p>

                {settingsQuery.isLoading ? (
                  <div
                    className="mt-6 space-y-5 animate-pulse"
                    aria-label="Loading learning preferences"
                    data-testid="loading-learning-preferences"
                  >
                    <div className="h-20 rounded-2xl bg-muted" />
                    <div className="h-12 rounded-2xl bg-muted" />
                  </div>
                ) : settingsQuery.isError ? (
                  <div
                    role="alert"
                    className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4"
                    data-testid="error-learning-preferences"
                  >
                    <p className="text-sm font-semibold">
                      Your preferences couldn’t be loaded.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Your saved choices haven’t been changed.
                    </p>
                    <button
                      type="button"
                      onClick={() => void settingsQuery.refetch()}
                      data-testid="button-retry-settings"
                      className="mt-3 text-xs font-bold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Try again
                    </button>
                  </div>
                ) : (
                  <div className="mt-6 space-y-7">
                    <div>
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <label
                            htmlFor="weekly-goal"
                            className="text-sm font-bold"
                          >
                            Weekly study goal
                          </label>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            A weekly target to help make progress visible.
                          </p>
                        </div>
                        <div className="flex items-baseline gap-1.5 rounded-xl bg-secondary/70 px-3 py-2 text-secondary-foreground">
                          <output
                            htmlFor="weekly-goal"
                            className="font-data text-xl font-semibold tabular-nums"
                            data-testid="text-weekly-goal"
                          >
                            {goalHours}
                          </output>
                          <span className="text-xs font-semibold">
                            {goalHours === 1 ? "hour" : "hours"} / week
                          </span>
                        </div>
                      </div>
                      <div className="mt-4">
                        <input
                          id="weekly-goal"
                          type="range"
                          min={1}
                          max={20}
                          step={1}
                          value={goalHours}
                          onChange={(event) => {
                            setGoalHours(Number(event.currentTarget.value));
                            setSavedMessage("");
                          }}
                          aria-valuetext={`${goalHours} ${goalHours === 1 ? "hour" : "hours"} per week`}
                          data-testid="input-weekly-study-goal"
                          className="h-2 w-full cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-card"
                        />
                        <div className="mt-2 flex justify-between font-data text-[10px] text-muted-foreground">
                          <span>1 hour</span>
                          <span>10</span>
                          <span>20 hours</span>
                        </div>
                      </div>
                      {weeklyHours.length > 0 && (
                        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border/80 bg-background/50 px-3 py-2.5">
                          <div className="flex h-7 items-end gap-1" aria-hidden="true">
                            {weeklyHours.map((hours, index) => (
                              <span
                                key={`${index}-${hours}`}
                                className={`w-1.5 rounded-t-sm ${
                                  hours > 0 ? "bg-primary/75" : "bg-muted"
                                }`}
                                style={{
                                  height: `${Math.max(5, Math.min(28, (hours / Math.max(goalHours, 1)) * 28))}px`,
                                }}
                              />
                            ))}
                          </div>
                          <p
                            className="text-[11px] leading-4 text-muted-foreground"
                            data-testid="text-weekly-progress-context"
                          >
                            {weeklyTotal > 0
                              ? `Your dashboard shows ${weeklyTotal.toFixed(1).replace(/\.0$/, "")} study hours this week.`
                              : "Your dashboard will show study time here as you build a rhythm."}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-border pt-6">
                      <div>
                        <label
                          htmlFor="coach-style"
                          className="text-sm font-bold"
                        >
                          Coach style
                        </label>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Set the tone for your learning conversations.
                        </p>
                      </div>
                      <div className="relative mt-3">
                        <select
                          id="coach-style"
                          value={coachStyle}
                          onChange={(event) => {
                            setCoachStyle(event.currentTarget.value as CoachStyle);
                            setSavedMessage("");
                          }}
                          data-testid="select-coach-style"
                          className="min-h-12 w-full appearance-none rounded-xl border border-input bg-background px-4 pr-11 text-sm font-semibold text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                        >
                          {coachOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.title}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={16}
                          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                        />
                      </div>
                      <p
                        className="mt-3 rounded-xl bg-muted/65 px-3.5 py-3 text-xs leading-5 text-muted-foreground"
                        data-testid="text-coach-style-description"
                      >
                        {coachOptions.find((option) => option.value === coachStyle)
                          ?.description}
                        <span className="mt-1 block text-foreground/80">
                          {coachOptions.find((option) => option.value === coachStyle)
                            ?.sample}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-col-reverse items-start justify-between gap-3 border-t border-border pt-5 sm:flex-row sm:items-center">
                      <p
                        role="status"
                        aria-live="polite"
                        data-testid="status-save-preferences"
                        className={`min-h-5 text-xs ${
                          savedMessage.startsWith("Couldn’t")
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }`}
                      >
                        {updateSettings.isPending
                          ? "Saving your preferences…"
                          : savedMessage ||
                            (isDirty
                              ? "You have unsaved changes."
                              : "Changes are saved to your learning profile.")}
                      </p>
                      <button
                        type="button"
                        onClick={savePreferences}
                        disabled={
                          !isDirty ||
                          updateSettings.isPending ||
                          settingsQuery.isError
                        }
                        data-testid="button-save-preferences"
                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
                      >
                        {updateSettings.isPending ? (
                          "Saving…"
                        ) : (
                          <>
                            Save preferences <ArrowRight size={15} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <PersonalDetailsForm />

          <section
            aria-labelledby="privacy-heading"
            className="flex gap-4 rounded-[22px] border border-primary/15 bg-primary/[.045] p-5 sm:p-6"
            data-testid="section-privacy"
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck size={17} />
            </div>
            <div>
              <h2 id="privacy-heading" className="text-sm font-bold">
                A private place to learn
              </h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                Your learning activity and preferences belong to your signed-in
                account. Fieldnote uses your choices to shape your learning
                workspace; they aren’t shared with other learners.
              </p>
            </div>
          </section>
        </main>

        <aside className="space-y-5">
          <section
            aria-labelledby="account-heading"
            className="overflow-hidden rounded-[24px] border border-card-border bg-card"
            data-testid="section-account-shortcut"
          >
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <UserRound size={15} className="text-primary" />
              <h2
                id="account-heading"
                className="font-data text-[10px] font-semibold uppercase tracking-[.16em]"
              >
                Account
              </h2>
            </div>
            {!isLoaded ? (
              <div className="animate-pulse p-5" data-testid="loading-account">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-28 rounded bg-muted" />
                    <div className="h-2.5 w-36 rounded bg-muted" />
                  </div>
                </div>
              </div>
            ) : user ? (
              <>
                <div className="flex items-center gap-3 p-5">
                  <div
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#d7e8d8] text-sm font-extrabold text-[#235b4b]"
                    data-testid="text-account-initials"
                  >
                    {initials(displayName)}
                  </div>
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-bold"
                      data-testid="text-account-name"
                    >
                      {displayName || "Learner"}
                    </p>
                    <p
                      className="mt-0.5 truncate text-xs text-muted-foreground"
                      data-testid="text-account-email"
                    >
                      {email || "Email not available"}
                    </p>
                  </div>
                </div>
                <div className="space-y-1 border-t border-border p-2">
                  <Link
                    href="/account"
                    data-testid="link-account-details"
                    className="flex min-h-11 items-center justify-between rounded-xl px-3 text-xs font-semibold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Account details <ArrowRight size={14} className="text-muted-foreground" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => void signOut({ redirectUrl: "/" })}
                    data-testid="button-sign-out-settings"
                    className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-xs font-semibold text-muted-foreground transition hover:bg-destructive/5 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <div className="p-5" data-testid="empty-account">
                <p className="text-sm font-semibold">Account details unavailable</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Sign-in information could not be loaded.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-[22px] border border-card-border bg-card p-5">
            <div className="flex items-center gap-2 text-primary">
              <CircleHelp size={15} />
              <span className="font-data text-[9px] font-semibold uppercase tracking-[.16em]">
                A useful reminder
              </span>
            </div>
            <p className="mt-3 font-display text-lg font-bold leading-snug tracking-[-.03em]">
              The best goal is the one that leaves room for real life.
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              You can adjust your weekly commitment whenever your schedule
              changes.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}