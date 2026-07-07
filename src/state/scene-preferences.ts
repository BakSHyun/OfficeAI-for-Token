export const SCENE_SFX_KEY = "officeai.scene-sfx";
export const SCENE_FOLLOW_KEY = "officeai.scene-follow";

export function loadSceneSfxEnabled(): boolean {
  try {
    return localStorage.getItem(SCENE_SFX_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveSceneSfxEnabled(enabled: boolean) {
  localStorage.setItem(SCENE_SFX_KEY, enabled ? "1" : "0");
}

export function loadSceneFollowEnabled(): boolean {
  try {
    return localStorage.getItem(SCENE_FOLLOW_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveSceneFollowEnabled(enabled: boolean) {
  localStorage.setItem(SCENE_FOLLOW_KEY, enabled ? "1" : "0");
}
