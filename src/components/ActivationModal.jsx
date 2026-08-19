import { motion } from "framer-motion";

export default function ActivationModal({ onUnlock }) {
  return (
    <motion.div className="boot-gate" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div
        className="boot-card"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 180 }}
      >
        <div className="boot-orb" />
        <h2>JARVIS AUDIO UNLOCK</h2>
        <p>
          المتصفح يمنع الميكروفون والسماعات بدون إيماءة. اضغط مرة واحدة لتفعيل القناة الصوتية طوال الجلسة.
        </p>
        <button type="button" onClick={onUnlock}>
          تفعيل النظام الصوتي
        </button>
      </motion.div>
    </motion.div>
  );
}
