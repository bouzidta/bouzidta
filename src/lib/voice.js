const WAKE = /(يا\s*)?جارفيس|jarvis|hey jarvis/i;

export function createVoiceEngine({ onHeard, onMic, onMode }) {
  let rec = null;
  let audioCtx = null;
  let analyser = null;
  let stream = null;
  let unlocked = false;

  async function unlock() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") await audioCtx.resume();
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const src = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
    } catch {
      /* mic denied */
    }
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    g.gain.value = 0.00008;
    osc.connect(g).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.04);
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      speechSynthesis.speak(u);
    }
    unlocked = true;
    startListen();
    return { audioCtx, analyser, stream };
  }

  function startListen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    rec = new SR();
    rec.lang = "ar-SA";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onstart = () => onMic?.(true);
    rec.onend = () => {
      onMic?.(false);
      if (unlocked) {
        try { rec.start(); } catch { /* */ }
      }
    };
    rec.onresult = (ev) => {
      let said = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) said += ev.results[i][0].transcript;
      }
      said = said.trim();
      if (!said) return;
      const wake = WAKE.test(said);
      const cmd = said.replace(WAKE, "").trim();
      if (wake && !cmd) {
        onMode?.("LISTENING");
        speak("نعم، أستمع.");
        return;
      }
      if (!wake && onMode && true) {
        /* require wake unless already listening handled by parent */
      }
      onHeard?.(cmd || said, { wake });
    };
    try { rec.start(); } catch { /* */ }
  }

  function speak(text, { rate = 1, pitch = 1 } = {}) {
    if (!window.speechSynthesis || !text) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = /[\u0600-\u06FF]/.test(text) ? "ar-SA" : "en-US";
    u.rate = rate;
    u.pitch = pitch;
    speechSynthesis.speak(u);
  }

  function stopSpeak() {
    if (window.speechSynthesis) speechSynthesis.cancel();
  }

  function interrupt() {
    stopSpeak();
  }

  return { unlock, speak, stopSpeak, interrupt, getAnalyser: () => analyser };
}
