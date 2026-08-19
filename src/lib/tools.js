export function runTools(text, ctx) {
  const { tasks, notes, setTasks, setNotes, setCode, setTab } = ctx;
  const mTaskAdd = text.match(/^(task add|مهمة|اضف مهمة)\s+(.+)/i);
  const mTaskDone = text.match(/^task done\s+(\d+)/i);
  const mTaskDel = text.match(/^task del\s+(\d+)/i);
  const mNoteAdd = text.match(/^(note add|ملاحظة|لاحظ)\s+(.+)/i);
  const mNoteDel = text.match(/^note del\s+(\d+)/i);
  const mSearch = text.match(/^(search|ابحث|بحث)\s+(.+)/i);
  const mOpen = text.match(/^(open|افتح)\s+(.+)/i);
  const mWiki = text.match(/^(wiki|ويكي)\s+(.+)/i);
  const mCode = text.match(/^(code|كود)\s+([\s\S]+)/i);

  if (/^(help|مساعدة|اوامر|أوامر)$/i.test(text)) {
    return [
      "الأوامر:",
      "• search / ابحث — بحث سريع",
      "• open / افتح — رابط",
      "• task add | tasks | task done N | task del N",
      "• note add | notes",
      "• code — ملعب الأكواد",
      "• time / date / weather / clear",
      "• يا جارفيس — كلمة الإيقاظ",
    ].join("\n");
  }
  if (/^(tasks|المهام)$/i.test(text)) {
    setTab("tasks");
    return tasks.length
      ? tasks.map((t, i) => `${i + 1}. ${t.done ? "[✓]" : "[ ]"} ${t.text}`).join("\n")
      : "لا توجد مهام.";
  }
  if (/^(notes|الملاحظات)$/i.test(text)) {
    setTab("notes");
    return notes.length ? notes.map((n, i) => `${i + 1}. ${n}`).join("\n") : "لا توجد ملاحظات.";
  }
  if (mTaskAdd) {
    setTasks([...tasks, { text: mTaskAdd[2], done: false }]);
    setTab("tasks");
    return `أضفت المهمة: ${mTaskAdd[2]}`;
  }
  if (mTaskDone) {
    const i = +mTaskDone[1] - 1;
    if (!tasks[i]) return "رقم غير صالح.";
    setTasks(tasks.map((t, idx) => (idx === i ? { ...t, done: true } : t)));
    return "المهمة مكتملة.";
  }
  if (mTaskDel) {
    const i = +mTaskDel[1] - 1;
    if (!tasks[i]) return "رقم غير صالح.";
    setTasks(tasks.filter((_, idx) => idx !== i));
    return "حُذفت المهمة.";
  }
  if (mNoteAdd) {
    setNotes([...notes, mNoteAdd[2]]);
    setTab("notes");
    return "سُجّلت الملاحظة.";
  }
  if (mNoteDel) {
    const i = +mNoteDel[1] - 1;
    if (!notes[i]) return "رقم غير صالح.";
    setNotes(notes.filter((_, idx) => idx !== i));
    return "حُذفت الملاحظة.";
  }
  if (mSearch) {
    window.open(`https://duckduckgo.com/?q=${encodeURIComponent(mSearch[2])}`, "_blank", "noopener");
    return `بحث: ${mSearch[2]}`;
  }
  if (mOpen) {
    let u = mOpen[2].trim();
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    window.open(u, "_blank", "noopener");
    return `فتح ${u}`;
  }
  if (mWiki) {
    window.open(`https://ar.wikipedia.org/wiki/${encodeURIComponent(mWiki[2])}`, "_blank", "noopener");
    return `ويكيبيديا: ${mWiki[2]}`;
  }
  if (mCode) {
    setCode(generateCode(mCode[2]));
    setTab("code");
    return "الكود في ملعب CODE.";
  }
  if (/^weather|طقس/i.test(text)) {
    window.open("https://www.google.com/search?q=weather", "_blank", "noopener");
    return "صفحة الطقس.";
  }
  if (/^time|الوقت/i.test(text)) return `الوقت: ${new Date().toLocaleTimeString("ar")}`;
  if (/^date|التاريخ/i.test(text)) {
    return `التاريخ: ${new Date().toLocaleDateString("ar", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`;
  }
  if (/مرحبا|السلام|hello|hi/i.test(text)) return "أهلاً. جارفيس على الخط.";
  if (/من أنت|who are you/i.test(text)) return "نظام جارفيس الويب: وكيل متعدد الوسائط داخل المتصفح.";
  return `استلمت «${text}». اكتب help.`;
}

export function generateCode(prompt) {
  const p = (prompt || "").trim();
  if (/[{;]|function |const |let |class |def /.test(p)) return p;
  return `/** JARVIS playground · ${p} */\nfunction jarvisRun() {\n  console.log(${JSON.stringify(p)});\n  return { ok: true, ts: Date.now() };\n}\njarvisRun();\n`;
}
