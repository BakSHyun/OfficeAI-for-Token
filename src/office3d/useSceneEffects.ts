import { useEffect } from "react";
import { connectEngine } from "../state/engine-client";
import { loadSceneSfxEnabled } from "../state/scene-preferences";
import { playSceneTone } from "./scene-audio";

export function useSceneEffects() {
  useEffect(() => {
    const unsubscribe = connectEngine().subscribeRaw((event) => {
      if (!loadSceneSfxEnabled()) return;
      if (event.type === "run:completed") {
        playSceneTone("success");
      }
      if (event.type === "run:failed") {
        playSceneTone("fail");
      }
    });
    return unsubscribe;
  }, []);
}
