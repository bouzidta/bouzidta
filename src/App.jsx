import { useEffect, useMemo, useRef, useState } from "react";
import ActivationModal from "./components/ActivationModal.jsx";
import Orb from "./components/Orb.jsx";
import Waveform from "./components/Waveform.jsx";
import ChatPane from "./components/ChatPane.jsx";
import { Telemetry, TaskList, NoteList, CodePlayground } from "./components/SidePanels.jsx";
import { load, save } from "./lib/storage.js";
import { runTools } from "./lib/tools.js";
import { createVoiceEngine } from "./lib/voice.js";

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [mode, setMode] = useState("LOCKED");
  const [micOn, setMicOn] = useState(false);
  const [tab, setTab] = useState("chat");
  const [messages, setMessages] = useState([]);
  const [tasks, setTasks] = useState(() => load("jarvis.tasks", []));
  const [notes, setNotes] = useState(() => load("jarvis.notes", []));
  const [code, setCode] = useState("// playground");
  const [commands, setCommands] = useState(0);
  const [uptime, setUptime] = useState("00:00:00");
  const [clock, setClock] = useState("--:--:--");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [analyser, setAnalyser] = useState(null);
  const started = useRef(Date.now());
  const voiceRef = useRef(null);
  const abortType = useRef(false);

  const voice = useMemo(() => {
    const eng = createVoiceEngine({
      onHeard: (text, meta) => {
        abortType.current = true;
        eng.interrupt();
        if (!text && meta?.wake) return;
        dispatch(text, { fromVoice: true, wake: meta?.wake });
      },
      onMic: setMicOn,
      onMode: setMode,
    });
    voiceRef.current = eng;
    return eng;
  }, []);

  useEffect(() => save("jarvis.tasks", tasks), [tasks]);
  useEffect(() => save("jarvis.notes", notes), [notes]);

  useEffect(() => {
    const t = setInterval(() => {
      const now = new Date();
      setClock(now.toLocaleTimeString("en-GB"));
      const s = Math.floor((Date.now() - started.current) / 1000);
      const hh = String(Math.floor(s / 3600)).padStart(2, "0");
      const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      setUptime(`${hh}:${mm}:${ss}`);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  async function unlock() {
    const ctx = await voice.unlock();
    setAnalyser(ctx.analyser || null);
    setUnlocked(true);
    setMode("STANDBY");
    push("jarvis", "القناة الصوتية مفتوحة. قل يا جارفيس.");
    voice.speak("نظام جارفيس جاهز.", { rate, pitch });
  }

  function push(role, text) {
    setMessages((m) => [...m, { id: crypto.randomUUID(), role, text }]);
  }

  function dispatch(raw, meta = {}) {
    const text = (raw || "").trim();
    if (!text) return;
    abortType.current = true;
    voice.interrupt();
    setCommands((c) => c + 1);
    push("user", text);
    setMode("PROCESSING");
    const reply = runTools(text, { tasks, notes, setTasks, setNotes, setCode, setTab });
    setMode("EXECUTING");
    setTimeout(() => {
      push("jarvis", reply);
      voice.speak(String(reply).split("\n")[0], { rate, pitch });
      setMode("STANDBY");
    }, 280);
  }

  useEffect(() => {
    const root = document.getElementById("root");
    const onClick = (e) => {
      const b = e.target.closest("[data-cmd]");
      if (b) dispatch(b.dataset.cmd);
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  });

  return (
    <>
      <div className="scanlines" />
      <div className="vignette" />
      {!unlocked && <ActivationModal onUnlock={unlock} />}
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">◉</span>
          <div>
            <h1>J.A.R.V.I.S</h1>
            <p>Multi-Modal Web Agent HUD</p>
          </div>
        </div>
        <div className="top-meta">
          <span>{clock}</span>
          <span className="chip">LINK SECURE</span>
          <span className={`chip mic-chip ${micOn ? "on" : ""}`}>{micOn ? "MIC LIVE" : "MIC OFF"}</span>
        </div>
      </header>
      <main className="layout">
        <Telemetry uptime={uptime} commands={commands} tasks={tasks.length} notes={notes.length} />
        <section className="core">
          <Orb mode={mode} />
          <Waveform analyser={analyser} live={micOn} />
          <p className="hint">قل «يا جارفيس» أو اكتب أمراً</p>
          <div className="voice-controls">
            <label>سرعة <input type="range" min="0.6" max="1.6" step="0.05" value={rate} onChange={(e) => setRate(+e.target.value)} /></label>
            <label>نبرة <input type="range" min="0.5" max="1.6" step="0.05" value={pitch} onChange={(e) => setPitch(+e.target.value)} /></label>
          </div>
        </section>
        <aside className="panel">
          <div className="tabs">
            {["chat", "tasks", "notes", "code"].map((t) => (
              <button key={t} className={`tab ${tab === t ? "active" : ""}`} type="button" onClick={() => setTab(t)}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>
          {tab === "chat" && (
            <ChatPane
              messages={messages}
              onSend={dispatch}
              onMic={() => {
                abortType.current = true;
                voice.interrupt();
                setMode("LISTENING");
              }}
            />
          )}
          {tab === "tasks" && (
            <TaskList tasks={tasks} setTasks={setTasks} onAdd={(t) => dispatch("task add " + t)} />
          )}
          {tab === "notes" && (
            <NoteList notes={notes} setNotes={setNotes} onAdd={(n) => dispatch("note add " + n)} />
          )}
          {tab === "code" && (
            <CodePlayground
              code={code}
              onCopy={() => navigator.clipboard.writeText(code)}
            />
          )}
        </aside>
      </main>
      <footer className="footer">REACT · FRAMER MOTION · WEB SPEECH · LOCAL TOOLS · HUD</footer>
    </>
  );
}
