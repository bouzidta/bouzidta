export function Telemetry({ uptime, commands, tasks, notes }) {
  return (
    <aside className="panel">
      <h2>SYSTEM TELEMETRY</h2>
      <Meters />
      <div className="stat-grid">
        <div><small>UPTIME</small><strong>{uptime}</strong></div>
        <div><small>COMMANDS</small><strong>{commands}</strong></div>
        <div><small>TASKS</small><strong>{tasks}</strong></div>
        <div><small>NOTES</small><strong>{notes}</strong></div>
      </div>
      <h3>QUICK TOOLS</h3>
      <QuickTools />
    </aside>
  );
}

function Meters() {
  return (
    <div className="meters" id="meters">
      {["CPU SIM", "MEM CACHE", "NET LAT"].map((l) => (
        <div className="meter" key={l}>
          <label>{l}</label>
          <div className="bar"><i style={{ width: `${20 + Math.random() * 40}%` }} /></div>
          <span>--</span>
        </div>
      ))}
    </div>
  );
}

function QuickTools() {
  return (
    <div className="tool-btns">
      <button type="button" data-cmd="help">مساعدة</button>
      <button type="button" data-cmd="tasks">المهام</button>
      <button type="button" data-cmd="notes">الملاحظات</button>
      <button type="button" data-cmd="code console.log('hello jarvis')">كود</button>
      <button type="button" data-cmd="search open source AI">بحث</button>
      <button type="button" data-cmd="weather">طقس</button>
    </div>
  );
}

export function TaskList({ tasks, setTasks, onAdd }) {
  return (
    <div className="tab-pane active">
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          const inp = e.target.elements.t;
          if (inp.value.trim()) onAdd(inp.value.trim());
          inp.value = "";
        }}
      >
        <input name="t" placeholder="مهمة جديدة…" />
        <button type="submit">+</button>
      </form>
      <ul className="list">
        {tasks.map((t, i) => (
          <li key={i} className={t.done ? "done" : ""}>
            <span>{t.text}</span>
            <span>
              <button type="button" onClick={() => setTasks(tasks.map((x, idx) => (idx === i ? { ...x, done: !x.done } : x)))}>✓</button>
              <button type="button" onClick={() => setTasks(tasks.filter((_, idx) => idx !== i))}>✕</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NoteList({ notes, setNotes, onAdd }) {
  return (
    <div className="tab-pane active">
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          const inp = e.target.elements.n;
          if (inp.value.trim()) onAdd(inp.value.trim());
          inp.value = "";
        }}
      >
        <input name="n" placeholder="ملاحظة…" />
        <button type="submit">+</button>
      </form>
      <ul className="list">
        {notes.map((n, i) => (
          <li key={i}>
            <span>{n}</span>
            <button type="button" onClick={() => setNotes(notes.filter((_, idx) => idx !== i))}>✕</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CodePlayground({ code, onCopy }) {
  return (
    <div className="tab-pane active">
      <div className="code-toolbar">
        <span>CODE PLAYGROUND</span>
        <button type="button" onClick={onCopy}>نسخ</button>
      </div>
      <pre id="code-view"><code>{code}</code></pre>
    </div>
  );
}
