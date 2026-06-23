let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx || ctx.state === "closed") {
      ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
    }
    return ctx;
  } catch {
    return null;
  }
}

function playTone(
  ac: AudioContext,
  freqStart: number,
  freqEnd: number,
  startTime: number,
  duration: number,
  volume = 0.25,
  type: OscillatorType = "sine",
) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = type;
  const t = ac.currentTime + startTime;
  osc.frequency.setValueAtTime(freqStart, t);
  osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration * 0.8);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.start(t);
  osc.stop(t + duration);
}

export function playNotifySound() {
  const ac = getCtx();
  if (!ac) return;
  try {
    if (ac.state === "suspended") ac.resume();
    playTone(ac, 300, 600, 0, 0.12, 0.3, "sine");
    playTone(ac, 500, 900, 0.1, 0.12, 0.25, "sine");
    playTone(ac, 700, 200, 0.2, 0.22, 0.2, "triangle");
    playTone(ac, 900, 1400, 0.32, 0.18, 0.25, "sine");
  } catch {}
}

export function playSendSound() {
  const ac = getCtx();
  if (!ac) return;
  try {
    if (ac.state === "suspended") ac.resume();
    playTone(ac, 700, 1100, 0, 0.1, 0.15, "sine");
    playTone(ac, 1100, 1400, 0.08, 0.08, 0.1, "sine");
  } catch {}
}

export function unlockAudio() {
  const ac = getCtx();
  if (ac && ac.state === "suspended") ac.resume();
}
