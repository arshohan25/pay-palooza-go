const ONBOARDING_KEY = "mfs_onboarding_done";

export const hasSeenOnboarding = () =>
  localStorage.getItem(ONBOARDING_KEY) === "1";

export const markOnboardingDone = () =>
  localStorage.setItem(ONBOARDING_KEY, "1");
