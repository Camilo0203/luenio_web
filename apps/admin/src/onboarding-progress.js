const STORAGE_KEY = "luenio.onboarding.v1";
const DISMISS_KEY = "luenio.onboarding.dismissedUntil";

export const ONBOARDING_STEPS = [
  { id: "see_demo", label: "Ejecutar la demo en vivo" },
  { id: "move_stage", label: "Mover un lead de etapa" },
  { id: "add_note_or_tag", label: "Guardar notas o etiquetas" },
  { id: "export_csv", label: "Exportar leads a CSV" },
];

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { completed: {} };
    const parsed = JSON.parse(raw);
    return { completed: parsed.completed || {} };
  } catch {
    return { completed: {} };
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota / private mode
  }
}

export function markOnboardingStep(stepId) {
  if (!ONBOARDING_STEPS.some((step) => step.id === stepId)) return getOnboardingProgress();
  const store = readStore();
  store.completed[stepId] = true;
  writeStore(store);
  return getOnboardingProgress();
}

export function getOnboardingProgress() {
  const store = readStore();
  const steps = ONBOARDING_STEPS.map((step) => ({
    ...step,
    done: Boolean(store.completed[step.id]),
  }));
  const doneCount = steps.filter((step) => step.done).length;
  return {
    steps,
    doneCount,
    total: steps.length,
    complete: doneCount >= steps.length,
  };
}

export function isOnboardingBannerDismissed(now = Date.now()) {
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Number.isFinite(until) && until > now;
  } catch {
    return false;
  }
}

export function dismissOnboardingBanner(days = 30) {
  try {
    const until = Date.now() + days * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
  } catch {
    // ignore
  }
}
