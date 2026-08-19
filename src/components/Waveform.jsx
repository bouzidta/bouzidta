import { useEffect, useRef } from "react";

export default function Waveform({ analyser, live }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!analyser || !ref.current) return;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const buf = new Uint8Array(analyser.frequencyBinCount);
    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      analyser.getByteTimeDomainData(buf);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.strokeStyle = live ? "#ff4fd8" : "#3df0ff";
      ctx.lineWidth = 2;
      const slice = canvas.width / buf.length;
      buf.forEach((v, i) => {
        const y = (v / 128) * (canvas.height / 2);
        i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * slice, y);
      });
      ctx.stroke();
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [analyser, live]);

  return <canvas ref={ref} id="waveform" className={live ? "live" : ""} width={520} height={72} />;
}
