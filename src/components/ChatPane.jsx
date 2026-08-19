import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

export default function ChatPane({ messages, onSend, onMic }) {
  const input = useRef(null);
  const box = useRef(null);
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [messages]);

  return (
    <div className="tab-pane active">
      <div className="chat" ref={box}>
        {messages.map((m) => (
          <motion.div
            key={m.id}
            className={`msg ${m.role}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="who">{m.role === "user" ? "OPERATOR" : "JARVIS"}</span>
            <div className="body">{m.text}</div>
          </motion.div>
        ))}
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          const v = input.current.value;
          input.current.value = "";
          onSend(v);
        }}
      >
        <button type="button" onClick={onMic} title="mic">🎙️</button>
        <input ref={input} placeholder="أمر أو سؤال…" autoComplete="off" />
        <button type="submit">إرسال</button>
      </form>
    </div>
  );
}
