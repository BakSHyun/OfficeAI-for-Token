export const ONBOARDING_KEY = "officeai.onboarded";

export function shouldShowOnboarding(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) !== "1";
}
