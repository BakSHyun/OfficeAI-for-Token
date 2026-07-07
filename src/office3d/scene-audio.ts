let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export function playSceneTone(kind: "success" | "fail") {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = kind === "success" ? 740 : 180;
    gain.gain.value = 0.06;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch {
    // 오디오 미지원 환경은 무시
  }
}
