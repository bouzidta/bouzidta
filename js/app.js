(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const state = {
    mode: "STANDBY",
    started: Date.now(),
    commands: 0,
    tasks: load("jarvis.tasks", []),
    notes: load("jarvis.notes", []),
    lastCode: "// سيتم عرض الكود المولّد هنا",
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

  function typeInto(el, text, speed = 12) {
    return new Promise((resolve) => {
      el.textContent = "";
      let i = 0;
      const t = setInterval(() => {
        el.textContent += text[i++] || "";
        if (i > text.length) { clearInterval(t); resolve(); }
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

  function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = /[\u0600-\u06FF]/.test(text) ? "ar-SA" : "en-US";
    u.rate = 1;
    speechSynthesis.speak(u);
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
        "الأوامر المتاحة:",
        "• help — هذه القائمة",
        "• search <كلمات> — بحث ويب (تبويب جديد)",
        "• open <رابط> — فتح رابط",
        "• task add <نص> / tasks / task done <رقم> / task del <رقم>",
        "• note add <نص> / notes / note del <رقم>",
        "• code <وصف أو كود> — نافذة الكود + نسخ",
        "• weather — فتح توقعات الطقس",
        "• time / date / clear / speak <نص>",
        "• wiki <موضوع> — ويكيبيديا",
      ].join("\n");
    },
    search(q) {
      const url = `https://duckduckgo.com/?q=${encodeURIComponent(q || "Jarvis AI")}`;
      window.open(url, "_blank", "noopener");
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
      const url = `https://ar.wikipedia.org/wiki/${encodeURIComponent(q)}`;
      window.open(url, "_blank", "noopener");
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
    return `/**
 * Generated by JARVIS Web System
 * Request: ${p}
 */
export function run() {
  console.log(${JSON.stringify(p)});
  return { ok: true, id: ${JSON.stringify(slug)}, at: Date.now() };
}

// مثال استخدام
// import { run } from './jarvis-gen.js';
// run();
`;
  }

  async function handleCommand(raw) {
    const text = raw.trim();
    if (!text) return;
    state.commands += 1;
    $("#cmd-count").textContent = state.commands;
    addMsg("user", text);
    setMode("PROCESSING");

    const lower = text.toLowerCase();
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
    else if (mCode) { showCode(generateCode(mCode[2])); reply = "الكود جاهز في نافذة CODE. يمكنك نسخه."; }
    else if (mSpeak) reply = tools.speak(mSpeak[2]);
    else if (/^weather|طقس/i.test(text)) reply = tools.weather();
    else if (/^time|الوقت/i.test(text)) reply = tools.time();
    else if (/^date|التاريخ/i.test(text)) reply = tools.date();
    else if (/^clear|مسح/i.test(text)) reply = tools.clear();
    else {
      reply = localReason(text, lower);
    }

    await new Promise((r) => setTimeout(r, 280));
    addMsg("jarvis", reply, true);
    speak(reply.split("\n")[0]);
    setMode("STANDBY");
  }

  function localReason(text, lower) {
    if (/مرحبا|السلام|hello|hi/.test(lower)) return "أهلاً بك. نظام جارفيس على الشبكة وجاهز لتنفيذ الأوامر.";
    if (/من أنت|who are you/.test(lower)) return "أنا جارفيس ويب: وكيل يعمل بالكامل داخل متصفحك. لا خادم، لا مفاتيح API.";
    if (/شكرا|thanks/.test(lower)) return "في الخدمة دائماً.";
    return `استلمت: «${text}». جرّب help أو search أو task add أو code.`;
  }

  // UI wiring
  $("#composer").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("#input").value;
    $("#input").value = "";
    handleCommand(v);
  });

  $$(".tool-btns button").forEach((b) => {
    b.addEventListener("click", () => handleCommand(b.dataset.cmd));
  });
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
      addMsg("jarvis", "تم نسخ الكود إلى الحافظة.");
    } catch {
      addMsg("jarvis", "تعذّر النسخ — انسخ يدوياً من نافذة CODE.");
    }
  });

  // Speech recognition
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    const rec = new SR();
    rec.lang = "ar-SA";
    rec.interimResults = false;
    rec.onstart = () => setMode("LISTENING");
    rec.onend = () => { if (state.mode === "LISTENING") setMode("STANDBY"); };
    rec.onresult = (ev) => {
      const said = ev.results[0][0].transcript;
      handleCommand(said);
    };
    $("#mic-btn").addEventListener("click", () => {
      try { rec.start(); } catch { /* already started */ }
    });
  } else {
    $("#mic-btn").addEventListener("click", () => {
      addMsg("jarvis", "متصفحك لا يدعم Web Speech API للتعرف على الصوت.");
    });
  }

  // Telemetry simulation
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

  renderTasks();
  renderNotes();
  tickClock();
  tickMeters();
  setInterval(tickClock, 1000);
  setInterval(tickMeters, 1600);
  addMsg("jarvis", "النظام متصل. كل المعالجة تتم محلياً في المتصفح. اكتب help للبدء.", true);
})();
