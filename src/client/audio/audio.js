
const MUSIC_SRC = 'audio/christmas-background-music-436117.mp3';

let audioCtx;
let backgroundAudio;
let musicEnabled = false;

export function ensureAudioContext() {
  if (audioCtx) return audioCtx;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  audioCtx = new AudioCtor();
  return audioCtx;
}

function getBackgroundAudio() {
  if (backgroundAudio) return backgroundAudio;
  const audio = new Audio(MUSIC_SRC);
  audio.loop = true;
  audio.volume = 0.34;
  audio.preload = 'auto';
  backgroundAudio = audio;
  return backgroundAudio;
}

export function startBackgroundMusic() {
  musicEnabled = true;
  const audio = getBackgroundAudio();
  if (!audio) return;
  const ctx = ensureAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  if (!audio.paused) return;
  const playPromise = audio.play();
  if (playPromise && playPromise.catch) {
    playPromise.catch(() => {});
  }
}

export function stopBackgroundMusic() {
  musicEnabled = false;
  if (!backgroundAudio) return;
  backgroundAudio.pause();
}

export function toggleBackgroundMusic() {
  if (musicEnabled && backgroundAudio && !backgroundAudio.paused) {
    stopBackgroundMusic();
    return false;
  }
  startBackgroundMusic();
  return isMusicPlaying();
}

export function isMusicPlaying() {
  return Boolean(musicEnabled && backgroundAudio && !backgroundAudio.paused);
}

export function playChime(pitches = [640, 880]) {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  pitches.forEach((pitch, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = pitch;
    gain.gain.setValueAtTime(0.2, ctx.currentTime + index * 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35 + index * 0.02);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + index * 0.02);
    osc.stop(ctx.currentTime + 0.4 + index * 0.02);
  });
}

export function playFootstepSound() {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 160;
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.21);
}
