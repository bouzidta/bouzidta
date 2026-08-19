(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const WAKE = /(يا\s*)?جارفيس|jarvis|hey jarvis/i;

  const state = {
    mode: "LOCKED",
    unlocked: false,
    micOn: false,
    started: Date.now(),
    commands: 0,
    tasks: load("jarvis.tasks", []),
    notes: load("jarvis.notes", []),
    lastCode: "// سيتم عرض الكود المولّد هنا",
    typeTimer: null,
    typeAbort: false,
    processing: false,
    audioCtx: null,
    analyser: null,
    micStream: null,
    rec: null,
    mediaRecorder: null,
    chunks: [],
    waveRaf: 0,
    keys: load("jarvis.keys", { openai: "", eleven: "", voiceId: "" }),
  };

  function load(k, fallback) {
    try { return JSON.parse(localStorage.getItem(k)) ?? fallback; }
    catch { return fallback; }
  }
  function save(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  function setMode(mode) {
    state.mode = mode;
    $("#state-label").textContent = mode;
    $("#orb").className = "orb-wrap " + mode.toLowerCase();
  }

  function setMicChip(on) {
    state.micOn = on;
    const chip = $("#mic-chip");
    chip.textContent = on ? "MIC LIVE" : "MIC OFF";
    chip.classList.toggle("on", on);
    $("#waveform").classList.toggle("live", on);
  }

  function abortTyping() {
    state.typeAbort = true;
    if (state.typeTimer) clearInterval(state.typeTimer);
    state.typeTimer = null;
  }

  function typeInto(el, text, speed = 12) {
    abortTyping();
    state.typeAbort = false;
    return new Promise((resolve) => {
      el.textContent = "";
      let i = 0;
      state.typeTimer = setInterval(() => {
        if (state.typeAbort) {
          clearInterval(state.typeTimer);
          state.typeTimer = null;
          resolve("aborted");
          return;
        }
        el.textContent += text[i++] || "";
        if (i > text.length) {
          clearInterval(state.typeTimer);
          state.typeTimer = null;
          resolve("done");
        }
      }, speed);
    });
  }

  function addMsg(role, text, animate = false) {
    const wrap = document.createElement("div");
    wrap.className = `msg ${role}`;
    wrap.innerHTML = `<span class="who">${role === "user" ? "OPERATOR" : "JARVIS"}</span><div class="body"></div>`;
    $("#chat").appendChild(wrap);
    const body = $(".body", wrap);
    if (animate) typeInto(body, text); else body.textContent = text;
    $("#chat").scrollTop = $("#chat").scrollHeight;
    return wrap;
  }

  /* ---------- Audio unlock + waveform ---------- */
  async function unlockAudio() {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (state.audioCtx.state === "suspended") await state.audioCtx.resume();
    try {
      state.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      addMsg("jarvis", "رُفض إذن الميكروفون. يمكنك الكتابة، والصوت يخرج عبر السماعات إن سُمح.");
    }
    if (state.micStream) {
      const src = state.audioCtx.createMediaStreamSource(state.micStream);
      state.analyser = state.audioCtx.createAnalyser();
      state.analyser.fftSize = 256;
      src.connect(state.analyser);
      drawWave();
    }
    // User-gesture beep to keep output unlocked
    const osc = state.audioCtx.createOscillator();
    const g = state.audioCtx.createGain();
    g.gain.value = 0.0001;
    osc.connect(g).connect(state.audioCtx.destination);
    osc.start(); osc.stop(state.audioCtx.currentTime + 0.05);
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0; speechSynthesis.speak(u);
    }
    state.unlocked = true;
    $("#boot-gate").classList.add("hidden");
    setMode("STANDBY");
    startWakeLoop();
    addMsg("jarvis", "القناة الصوتية مفتوحة. قل يا جارفيس ثم الأمر.", true);
    speak("نظام جارفيس جاهز.");
  }

  function drawWave() {
    const canvas = $("#waveform");
    const ctx = canvas.getContext("2d");
    const buf = new Uint8Array(state.analyser.frequencyBinCount);
    const loop = () => {
      state.waveRaf = requestAnimationFrame(loop);
      state.analyser.getByteTimeDomainData(buf);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.strokeStyle = state.micOn ? "#ff4fd8" : "#3df0ff";
      ctx.lineWidth = 2;
      const slice = canvas.width / buf.length;
      for (let i = 0; i < buf.length; i++) {
        const v = buf[i] / 128;
        const y = (v * canvas.height) / 2;
        i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * slice, y);
      }
      ctx.stroke();
    };
    loop();
  }

  /* ---------- TTS ---------- */
  function ttsSettings() {
    return {
      rate: +$("#tts-rate").value,
      pitch: +$("#tts-pitch").value,
      engine: $("#tts-engine").value,
    };
  }

  async function speak(text) {
    if (!text) return;
    stopSpeak();
    const { rate, pitch, engine } = ttsSettings();
    const useEleven = (engine === "eleven" || (engine === "auto" && state.keys.eleven)) && state.keys.eleven;
    if (useEleven) {
      try {
        await speakEleven(text, rate);
        return;
      } catch (e) {
        console.warn("ElevenLabs fallback", e);
      }
    }
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = /[\u0600-\u06FF]/.test(text) ? "ar-SA" : "en-US";
    u.rate = rate;
    u.pitch = pitch;
    speechSynthesis.speak(u);
  }

  function stopSpeak() {
    if (window.speechSynthesis) speechSynthesis.cancel();
    $$("audio.jarvis-tts").forEach((a) => { a.pause(); a.remove(); });
  }

  async function speakEleven(text, rate) {
    const voice = state.keys.voiceId || "21m00Tcm4TlvDq8ikWAM";
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": state.keys.eleven,
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
          style: Math.min(1, Math.max(0, (rate - 0.6) / 1)),
        },
      }),
    });
    if (!res.ok) throw new Error("eleven " + res.status);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.className = "jarvis-tts";
    audio.playbackRate = rate;
    document.body.appendChild(audio);
    await audio.play();
  }

  /* ---------- STT: Web Speech + Whisper ---------- */
  function startWakeLoop() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      $("#voice-hint").textContent = "لا يوجد Web Speech — استخدم زر الميكروفون مع Whisper إن وُجد مفتاح.";
      return;
    }
    const rec = new SR();
    rec.lang = "ar-SA";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onstart = () => setMicChip(true);
    rec.onend = () => {
      setMicChip(false);
      if (state.unlocked && !state.processing) {
        try { rec.start(); } catch { /* restart race */ }
      }
    };
    rec.onerror = () => { setMicChip(false); };
    rec.onresult = (ev) => {
      let said = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) said += ev.results[i][0].transcript;
      }
      if (!said.trim()) return;
      onHeard(said.trim(), "web");
    };
    state.rec = rec;
    try { rec.start(); } catch { /* */ }
  }

  function onHeard(transcript, source) {
    abortTyping();
    stopSpeak();
    let cmd = transcript;
    const wake = cmd.match(WAKE);
    if (wake) cmd = cmd.replace(WAKE, "").trim();
    if (!cmd && wake) {
      setMode("LISTENING");
      speak("نعم، أستمع.");
      return;
    }
    if (!wake && source === "web" && $("#stt-engine").value !== "whisper") {
      // continuous wake loop: ignore chatter without wake word
      if (state.mode !== "LISTENING") return;
    }
    handleCommand(cmd || transcript, { fromVoice: true });
  }

  async function startWhisperCapture() {
    if (!state.micStream) {
      addMsg("jarvis", "الميكروفون غير مفعّل.");
      return;
    }
    abortTyping();
    stopSpeak();
    setMode("LISTENING");
    setMicChip(true);
    state.chunks = [];
    const rec = new MediaRecorder(state.micStream);
    state.mediaRecorder = rec;
    rec.ondataavailable = (e) => { if (e.data.size) state.chunks.push(e.data); };
    rec.onstop = async () => {
      setMicChip(false);
      const blob = new Blob(state.chunks, { type: rec.mimeType || "audio/webm" });
      try {
        const text = await transcribeWhisper(blob);
        if (text) onHeard(text, "whisper");
        else addMsg("jarvis", "لم أفهم الصوت (Whisper).");
      } catch (err) {
        addMsg("jarvis", "فشل Whisper — تحقق من المفتاح أو CORS. أعود لـ Web Speech.");
        console.warn(err);
      }
    };
    rec.start();
    setTimeout(() => { if (rec.state === "recording") rec.stop(); }, 6000);
  }

  async function transcribeWhisper(blob) {
    if (!state.keys.openai) throw new Error("no openai key");
    const fd = new FormData();
    fd.append("file", blob, "speech.webm");
    fd.append("model", "whisper-1");
    fd.append("language", "ar");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: "Bearer " + state.keys.openai },
      body: fd,
    });
    if (!res.ok) throw new Error("whisper " + res.status);
    const json = await res.json();
    return json.text || "";
  }

  function openTab(name) {
    $$(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    $$(".tab-pane").forEach((p) => p.classList.toggle("active", p.id === `pane-${name}`));
  }

  function renderTasks() {
    const ul = $("#task-list");
    ul.innerHTML = "";
    state.tasks.forEach((t, i) => {
      const li = document.createElement("li");
      li.className = t.done ? "done" : "";
      li.innerHTML = `<span>${escapeHtml(t.text)}</span><span>
        <button data-act="toggle" data-i="${i}">✓</button>
        <button data-act="del" data-i="${i}">✕</button></span>`;
      ul.appendChild(li);
    });
    $("#task-count").textContent = state.tasks.length;
    save("jarvis.tasks", state.tasks);
  }

  function renderNotes() {
    const ul = $("#note-list");
    ul.innerHTML = "";
    state.notes.forEach((n, i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${escapeHtml(n)}</span><button data-ni="${i}">✕</button>`;
      ul.appendChild(li);
    });
    $("#note-count").textContent = state.notes.length;
    save("jarvis.notes", state.notes);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function showCode(code) {
    state.lastCode = code;
    $("#code-view code").textContent = code;
    openTab("code");
  }

  const tools = {
    help() {
      return [
        "الأوامر:",
        "• يا جارفيس + أمر — كلمة إيقاظ",
        "• search / open / wiki / weather / time / date",
        "• task add | note add | code | speak",
        "• ميكروفون: Web Speech فوري أو Whisper للدقة",
      ].join("\n");
    },
    search(q) {
      window.open(`https://duckduckgo.com/?q=${encodeURIComponent(q || "Jarvis AI")}`, "_blank", "noopener");
      return `فتحت نتائج البحث عن: ${q}`;
    },
    open(url) {
      let u = (url || "").trim();
      if (!u) return "حدد رابطاً.";
      if (!/^https?:\/\//i.test(u)) u = "https://" + u;
      window.open(u, "_blank", "noopener");
      return `جاري فتح ${u}`;
    },
    wiki(q) {
      window.open(`https://ar.wikipedia.org/wiki/${encodeURIComponent(q)}`, "_blank", "noopener");
      return `ويكيبيديا: ${q}`;
    },
    weather() {
      window.open("https://www.google.com/search?q=weather", "_blank", "noopener");
      return "فتحت صفحة الطقس.";
    },
    time() { return `الوقت الحالي: ${new Date().toLocaleTimeString("ar")}`; },
    date() { return `التاريخ: ${new Date().toLocaleDateString("ar", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`; },
    speak(t) { speak(t || "نظام جارفيس جاهز"); return t || "تم النطق."; },
    clear() { $("#chat").innerHTML = ""; return "تم مسح المحادثة."; },
  };

  function generateCode(prompt) {
    const p = (prompt || "").trim();
    if (!p) return "// اكتب: code وصف ما تريد";
    if (/[{;]|function|const |let |class |def |#include/.test(p)) return p;
    const slug = p.replace(/\s+/g, "-").slice(0, 24);
    return `/** JARVIS generated: ${p} */\nexport function run() {\n  return { ok: true, id: ${JSON.stringify(slug)}, at: Date.now() };\n}\n`;
  }

  async function handleCommand(raw, meta = {}) {
    const text = (raw || "").trim();
    if (!text) return;
    state.processing = true;
    state.commands += 1;
    $("#cmd-count").textContent = state.commands;
    addMsg("user", text);
    setMode("PROCESSING");

    let reply;
    const mTaskAdd = text.match(/^(task add|مهمة|اضف مهمة)\s+(.+)/i);
    const mTaskDone = text.match(/^task done\s+(\d+)/i);
    const mTaskDel = text.match(/^task del\s+(\d+)/i);
    const mNoteAdd = text.match(/^(note add|ملاحظة|لاحظ)\s+(.+)/i);
    const mNoteDel = text.match(/^note del\s+(\d+)/i);
    const mSearch = text.match(/^(search|ابحث|بحث)\s+(.+)/i);
    const mOpen = text.match(/^(open|افتح)\s+(.+)/i);
    const mWiki = text.match(/^(wiki|ويكي)\s+(.+)/i);
    const mCode = text.match(/^(code|كود)\s+([\s\S]+)/i);
    const mSpeak = text.match(/^(speak|قل)\s+(.+)/i);

    if (/^(help|مساعدة|اوامر|أوامر)$/i.test(text)) reply = tools.help();
    else if (/^(tasks|المهام)$/i.test(text)) { openTab("tasks"); reply = state.tasks.length ? state.tasks.map((t, i) => `${i + 1}. ${t.done ? "[✓]" : "[ ]"} ${t.text}`).join("\n") : "لا توجد مهام."; }
    else if (/^(notes|الملاحظات)$/i.test(text)) { openTab("notes"); reply = state.notes.length ? state.notes.map((n, i) => `${i + 1}. ${n}`).join("\n") : "لا توجد ملاحظات."; }
    else if (mTaskAdd) {
      state.tasks.push({ text: mTaskAdd[2], done: false });
      renderTasks(); openTab("tasks");
      reply = `أضفت المهمة: ${mTaskAdd[2]}`;
    } else if (mTaskDone) {
      const i = +mTaskDone[1] - 1;
      if (state.tasks[i]) { state.tasks[i].done = true; renderTasks(); reply = "تم تعليم المهمة كمكتملة."; }
      else reply = "رقم غير صالح.";
    } else if (mTaskDel) {
      const i = +mTaskDel[1] - 1;
      if (state.tasks[i]) { state.tasks.splice(i, 1); renderTasks(); reply = "حُذفت المهمة."; }
      else reply = "رقم غير صالح.";
    } else if (mNoteAdd) {
      state.notes.push(mNoteAdd[2]); renderNotes(); openTab("notes");
      reply = "سُجّلت الملاحظة.";
    } else if (mNoteDel) {
      const i = +mNoteDel[1] - 1;
      if (state.notes[i]) { state.notes.splice(i, 1); renderNotes(); reply = "حُذفت الملاحظة."; }
      else reply = "رقم غير صالح.";
    } else if (mSearch) reply = tools.search(mSearch[2]);
    else if (mOpen) reply = tools.open(mOpen[2]);
    else if (mWiki) reply = tools.wiki(mWiki[2]);
    else if (mCode) { showCode(generateCode(mCode[2])); reply = "الكود جاهز في نافذة CODE."; }
    else if (mSpeak) reply = tools.speak(mSpeak[2]);
    else if (/^weather|طقس/i.test(text)) reply = tools.weather();
    else if (/^time|الوقت/i.test(text)) reply = tools.time();
    else if (/^date|التاريخ/i.test(text)) reply = tools.date();
    else if (/^clear|مسح/i.test(text)) reply = tools.clear();
    else reply = localReason(text);

    await new Promise((r) => setTimeout(r, 180));
    addMsg("jarvis", reply, !meta.fromVoice);
    await speak(reply.split("\n")[0]);
    setMode("STANDBY");
    state.processing = false;
  }

  function localReason(text) {
    const lower = text.toLowerCase();
    if (/مرحبا|السلام|hello|hi/.test(lower)) return "أهلاً بك. القناة الصوتية والنصية جاهزتان.";
    if (/من أنت|who are you/.test(lower)) return "جارفيس متعدد الوسائط: استماع فوري، همس اختياري، ونطق بشري.";
    if (/شكرا|thanks/.test(lower)) return "في الخدمة دائماً.";
    return `استلمت: «${text}». قل help للأوامر.`;
  }

  $("#composer").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("#input").value;
    $("#input").value = "";
    handleCommand(v);
  });
  $$(".tool-btns button").forEach((b) => b.addEventListener("click", () => handleCommand(b.dataset.cmd)));
  $$(".tab").forEach((b) => b.addEventListener("click", () => openTab(b.dataset.tab)));
  $("#task-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("#task-input").value.trim();
    if (!v) return;
    $("#task-input").value = "";
    handleCommand("task add " + v);
  });
  $("#note-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("#note-input").value.trim();
    if (!v) return;
    $("#note-input").value = "";
    handleCommand("note add " + v);
  });
  $("#task-list").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const i = +btn.dataset.i;
    if (btn.dataset.act === "toggle" && state.tasks[i]) state.tasks[i].done = !state.tasks[i].done;
    if (btn.dataset.act === "del") state.tasks.splice(i, 1);
    renderTasks();
  });
  $("#note-list").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    state.notes.splice(+btn.dataset.ni, 1);
    renderNotes();
  });
  $("#copy-code").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(state.lastCode);
      addMsg("jarvis", "تم نسخ الكود.");
    } catch {
      addMsg("jarvis", "انسخ يدوياً من نافذة CODE.");
    }
  });
  $("#mic-btn").addEventListener("click", () => {
    if (!state.unlocked) return;
    abortTyping();
    stopSpeak();
    if ($("#stt-engine").value === "whisper") startWhisperCapture();
    else if (state.rec) {
      setMode("LISTENING");
      try { state.rec.stop(); } catch { /* */ }
      try { state.rec.start(); } catch { /* */ }
    }
  });
  $("#unlock-btn").addEventListener("click", unlockAudio);
  $("#keys-form").addEventListener("submit", (e) => {
    e.preventDefault();
    state.keys = {
      openai: $("#openai-key").value.trim(),
      eleven: $("#eleven-key").value.trim(),
      voiceId: $("#eleven-voice").value.trim(),
    };
    save("jarvis.keys", state.keys);
    addMsg("jarvis", "حُفظت المفاتيح محلياً في هذا المتصفح فقط.");
  });

  function tickMeters() {
    const cpu = 8 + Math.round(Math.random() * 28);
    const mem = 22 + Math.round(Math.random() * 30);
    const net = 12 + Math.round(Math.random() * 40);
    $("#cpu-bar").style.width = cpu + "%";
    $("#mem-bar").style.width = mem + "%";
    $("#net-bar").style.width = Math.min(net, 100) + "%";
    $("#cpu-val").textContent = cpu + "%";
    $("#mem-val").textContent = mem + "%";
    $("#net-val").textContent = net + "ms";
  }
  function tickClock() {
    const now = new Date();
    $("#clock").textContent = now.toLocaleTimeString("en-GB");
    $("#date-label").textContent = now.toLocaleDateString("en-GB");
    const s = Math.floor((Date.now() - state.started) / 1000);
    const hh = String(Math.floor(s / 3600)).padStart(2, "0");
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    $("#uptime").textContent = `${hh}:${mm}:${ss}`;
  }

  $("#openai-key").value = state.keys.openai || "";
  $("#eleven-key").value = state.keys.eleven || "";
  $("#eleven-voice").value = state.keys.voiceId || "";
  renderTasks();
  renderNotes();
  tickClock();
  tickMeters();
  setInterval(tickClock, 1000);
  setInterval(tickMeters, 1600);
})();
