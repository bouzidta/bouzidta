import { motion } from "framer-motion";

export default function Orb({ mode }) {
  const colors = {
    LOCKED: "#7aa3b8",
    STANDBY: "#3df0ff",
    LISTENING: "#ff4fd8",
    PROCESSING: "#e8c36a",
    EXECUTING: "#7cffb2",
  };
  const c = colors[mode] || colors.STANDBY;
  return (
    <div className={`orb-wrap ${mode.toLowerCase()}`}>
      <motion.div className="ring r1" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 12, ease: "linear" }} />
      <motion.div className="ring r2" animate={{ rotate: -360 }} transition={{ repeat: Infinity, duration: 18, ease: "linear" }} />
      <motion.div className="ring r3" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 8, ease: "linear" }} />
      <motion.div
        className="core-glow"
        animate={{ opacity: [0.55, 1, 0.55], scale: [0.96, 1.04, 0.96] }}
        transition={{ repeat: Infinity, duration: 2.1 }}
        style={{ background: `radial-gradient(circle, ${c}, transparent 70%)` }}
      />
      <div className="core-inner" style={{ borderColor: c }}>
        <span>{mode}</span>
      </div>
    </div>
  );
}
