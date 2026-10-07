import { useRef, useState, useEffect, useCallback } from "react";

import btnB from "./assets/B.mp3";
import btnC from "./assets/C.mp3";
import btnD from "./assets/D.mp3";
import btnE from "./assets/E.mp3";
import btnF from "./assets/F.mp3";

const buttons = [
  { id: "B", key: "B", sound: btnB, frequency: 493.88, note: "B4" },
  { id: "C", key: "C", sound: btnC, frequency: 261.63, note: "C4" },
  { id: "D", key: "D", sound: btnD, frequency: 293.66, note: "D4" },
  { id: "E", key: "E", sound: btnE, frequency: 329.63, note: "E4" },
  { id: "F", key: "F", sound: btnF, frequency: 349.23, note: "F4" },
];

const JADOO_MELODY = [
  "B", "C", "F", "E", "B", "C", "E", "D", "B", "C", "F", "E", "D", "C",
];
const TARGET_SEQUENCE = "BCFEBCEDBCFEDC";

function App() {
  const audioContextRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const audioCacheRef = useRef({});
  const logRef = useRef(null);

  const [activeButton, setActiveButton] = useState(null);
  const [frequency, setFrequency] = useState(0);
  const [status, setStatus] = useState("BOOTING...");
  const [booted, setBooted] = useState(false);
  const [isPlayingMelody, setIsPlayingMelody] = useState(false);
  const [signalStrength, setSignalStrength] = useState(0);
  const [log, setLog] = useState([]);
  const [volume, setVolume] = useState(0.6);
  const [melodyProgress, setMelodyProgress] = useState(0);

  const [scene, setScene] = useState("terminal");
  const [typedText, setTypedText] = useState("");

  const userSequenceRef = useRef([]);

  // 🔋 Boot
  useEffect(() => {
    const logs = [
      "INITIALIZING...",
      "LOADING MODULES...",
      "CALIBRATING...",
      "SYSTEM READY",
    ];
    let i = 0;
    const interval = setInterval(() => {
      setStatus(logs[i]);
      if (i === logs.length - 1) {
        clearInterval(interval);
        setTimeout(() => setBooted(true), 400);
      }
      i++;
    }, 300);
    return () => clearInterval(interval);
  }, []);

  // 🎵 Preload
  useEffect(() => {
    buttons.forEach((btn) => {
      if (btn.sound) {
        const audio = new Audio(btn.sound);
        audio.preload = "auto";
        audio.volume = volume;
        audioCacheRef.current[btn.id] = audio;
      }
    });
  }, []); // eslint-disable-line

  useEffect(() => {
    Object.values(audioCacheRef.current).forEach((a) => (a.volume = volume));
  }, [volume]);

  // 📊 Visualizer
  useEffect(() => {
    if (!booted || scene !== "terminal") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const bars = 40;
      const barW = W / bars - 2;
      const time = Date.now() / 150;
      const amp = activeButton ? 1 : 0.15;

      for (let i = 0; i < bars; i++) {
        const h =
          Math.abs(Math.sin(time + i * 0.4)) * H * 0.7 * amp +
          Math.sin(time * 2 + i) * 4 +
          4;
        const x = i * (barW + 2);
        const y = H - h;
        const grad = ctx.createLinearGradient(0, y, 0, H);
        grad.addColorStop(0, activeButton ? "#a855f7" : "#22d3ee");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.shadowBlur = activeButton ? 12 : 4;
        ctx.shadowColor = activeButton ? "#a855f7" : "#22d3ee";
        ctx.fillRect(x, y, barW, h);
      }
      ctx.shadowBlur = 0;
    };
    draw();
    return () => cancelAnimationFrame(animationRef.current);
  }, [booted, activeButton, scene]);

  // ▶️ Play tone
  const playTone = useCallback(
    async (button, duration = 0.6, skipLog = false) => {
      if (button.sound && audioCacheRef.current[button.id]) {
        const audio = audioCacheRef.current[button.id];
        audio.currentTime = 0;
        audio.volume = volume;
        audio.play().catch(() => {});
      } else {
        if (!audioContextRef.current) {
          const AC = window.AudioContext || window.webkitAudioContext;
          audioContextRef.current = new AC();
        }
        const ac = audioContextRef.current;
        if (ac.state === "suspended") await ac.resume();
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = "sine";
        osc.frequency.value = button.frequency;
        g.gain.setValueAtTime(0.0001, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
        osc.connect(g);
        g.connect(ac.destination);
        osc.start();
        osc.stop(ac.currentTime + duration);
      }

      if (!skipLog) {
        setLog((prev) => [...prev.slice(-30), button.id]);
      }

      setActiveButton(button.id);
      setFrequency(button.frequency);
      setStatus("◉ TRANSMITTING");
      setSignalStrength(Math.floor(Math.random() * 30) + 70);

      setTimeout(() => {
        setActiveButton(null);
        setStatus("SYSTEM READY");
        setSignalStrength(0);
      }, duration * 1000);
    },
    [volume],
  );

  // 🎯 Check sequence
  const checkSequence = useCallback(() => {
    const userSeq = userSequenceRef.current.join("");
    if (userSeq === TARGET_SEQUENCE) {
      userSequenceRef.current = [];
      setTimeout(() => setScene("destroying"), 400);
      return true;
    }
    return false;
  }, []);

  // ▶️ Handle press
  const handlePress = useCallback(
    (button) => {
      if (scene !== "terminal") return;
      playTone(button);
      userSequenceRef.current.push(button.id);
      if (userSequenceRef.current.length > TARGET_SEQUENCE.length) {
        userSequenceRef.current = userSequenceRef.current.slice(
          -TARGET_SEQUENCE.length,
        );
      }
      checkSequence();
    },
    [playTone, checkSequence, scene],
  );

  // ⌨️ Keyboard
  useEffect(() => {
    const handleKey = (e) => {
      if (isPlayingMelody || scene !== "terminal") return;
      const btn = buttons.find((b) => b.key === e.key.toUpperCase());
      if (btn) handlePress(btn);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handlePress, isPlayingMelody, scene]);

  // 🎵 Melody
  const playJadooMelody = async () => {
    if (isPlayingMelody || scene !== "terminal") return;
    setIsPlayingMelody(true);
    setStatus("◉ TRANSMITTING MELODY");
    setLog([]);
    setMelodyProgress(0);

    for (let i = 0; i < JADOO_MELODY.length; i++) {
      const noteId = JADOO_MELODY[i];
      const btn = buttons.find((b) => b.id === noteId);
      if (!btn) continue;
      setMelodyProgress(((i + 1) / JADOO_MELODY.length) * 100);
      playTone(btn, 0.45);
      await new Promise((r) => setTimeout(r, 480));
    }

    setStatus("SYSTEM READY");
    setIsPlayingMelody(false);
    setTimeout(() => setMelodyProgress(0), 1000);
  };

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // 🎬 Scene transitions
  useEffect(() => {
    if (scene === "destroying") {
      const t1 = setTimeout(() => setScene("revealing"), 1800);
      return () => clearTimeout(t1);
    }
    if (scene === "revealing") {
      const t = setTimeout(() => setScene("jadoo"), 1200);
      return () => clearTimeout(t);
    }
    if (scene === "jadoo") {
      const text = "HELLO";
      let i = 0;
      const interval = setInterval(() => {
        setTypedText(text.slice(0, i + 1));
        i++;
        if (i >= text.length) clearInterval(interval);
      }, 250);
      return () => clearInterval(interval);
    }
  }, [scene]);

  const resetScene = () => {
    setScene("terminal");
    setTypedText("");
    setLog([]);
    userSequenceRef.current = [];
  };

  // ═══════════ SCENE: DESTROYING (POWER OUTAGE) ═══════════
  if (scene === "destroying") {
    return (
      <main className="relative h-screen w-screen overflow-hidden bg-black">
        <div className="absolute inset-0 animate-blackout-flicker bg-black">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.08),transparent_70%)]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="font-mono text-lg tracking-[0.5em] text-cyan-500/40">
              ▓▒░ SYSTEM ░▒▓
            </p>
          </div>
        </div>

        <div className="absolute inset-0 animate-power-surge bg-white" />
        <div className="absolute inset-0 animate-fade-to-dark bg-black opacity-0" />

        {Array.from({ length: 25 }).map((_, i) => (
          <div
            key={i}
            className="absolute bg-cyan-300"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 60 + 20}px`,
              opacity: 0,
              animation: `spark-flash ${Math.random() * 0.4 + 0.3}s ease-out infinite`,
              animationDelay: `${Math.random() * 1.2}s`,
              transform: `rotate(${Math.random() * 180}deg)`,
              boxShadow:
                "0 0 10px rgba(34,211,238,1), 0 0 20px rgba(34,211,238,0.6)",
              filter: "blur(0.5px)",
            }}
          />
        ))}

        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {Array.from({ length: 5 }).map((_, i) => {
            const startX = Math.random() * 100;
            const startY = Math.random() * 100;
            const points = Array.from({ length: 8 })
              .map((_, j) => {
                const x = startX + (Math.random() - 0.5) * 30;
                const y = startY + (Math.random() - 0.5) * 30;
                return `${x},${y}`;
              })
              .join(" ");
            return (
              <polyline
                key={i}
                points={points}
                stroke="#67e8f9"
                strokeWidth="0.3"
                fill="none"
                style={{
                  filter: "drop-shadow(0 0 4px #22d3ee)",
                  opacity: 0,
                  animation: `arc-flash ${Math.random() * 0.5 + 0.3}s ease-out infinite`,
                  animationDelay: `${Math.random() * 1.5}s`,
                }}
              />
            );
          })}
        </svg>

        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-full bg-cyan-400/20"
            style={{
              top: `${Math.random() * 100}%`,
              height: `${Math.random() * 10 + 3}px`,
              opacity: 0,
              animation: `glitch-band ${Math.random() * 0.3 + 0.2}s ease-out infinite`,
              animationDelay: `${Math.random() * 1.2}s`,
              mixBlendMode: "screen",
              filter: "blur(1px)",
            }}
          />
        ))}

        <div className="absolute inset-0 animate-blackout-final bg-black opacity-0" />

        <div className="absolute bottom-6 right-6 flex items-center gap-2 opacity-0 animate-standby-led">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,1)]" />
          <span className="font-mono text-[10px] tracking-[0.3em] text-red-500/70">
            STANDBY
          </span>
        </div>

        <style>{`
          @keyframes blackout-flicker {
            0%{opacity:1}10%{opacity:.3}12%{opacity:1}25%{opacity:.6}
            27%{opacity:1}40%{opacity:.2}42%{opacity:.9}55%{opacity:.1}
            57%{opacity:.8}70%{opacity:.05}72%{opacity:.5}85%{opacity:0}100%{opacity:0}
          }
          @keyframes power-surge {
            0%,20%{opacity:0}22%{opacity:.9}24%{opacity:0}28%{opacity:.7}
            30%{opacity:0}55%{opacity:.4}58%{opacity:0}100%{opacity:0}
          }
          @keyframes fade-to-dark {0%,60%{opacity:0}100%{opacity:1}}
          @keyframes spark-flash {
            0%{opacity:0;transform:scale(.5) rotate(0)}20%{opacity:1;transform:scale(1.2) rotate(5deg)}
            100%{opacity:0;transform:scale(.3) rotate(-5deg)}
          }
          @keyframes arc-flash {0%{opacity:0}20%{opacity:1}40%{opacity:0}60%{opacity:.8}100%{opacity:0}}
          @keyframes glitch-band {
            0%{opacity:0;transform:translateX(0)}50%{opacity:.6;transform:translateX(20px)}
            100%{opacity:0;transform:translateX(-20px)}
          }
          @keyframes blackout-final {0%,70%{opacity:0}85%{opacity:1}100%{opacity:1}}
          @keyframes standby-led {0%,80%{opacity:0}100%{opacity:1}}
        `}</style>
      </main>
    );
  }

  // ═══════════ SCENE: REVEALING ═══════════
  if (scene === "revealing") {
    return (
      <main className="relative h-screen w-screen overflow-hidden bg-black">
        <div className="absolute inset-0 animate-white-flash bg-white" />
        <div className="absolute inset-0 animate-fade-to-black bg-black opacity-0" />
      </main>
    );
  }

  // ═══════════ SCENE: JADOO ═══════════
  if (scene === "jadoo") {
    return (
      <main className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-black px-4 py-6">
        <div className="pointer-events-none absolute inset-0">
          {Array.from({ length: 100 }).map((_, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: `${Math.random() * 2.5 + 0.5}px`,
                height: `${Math.random() * 2.5 + 0.5}px`,
                opacity: Math.random() * 0.9 + 0.1,
                animation: `twinkle ${Math.random() * 3 + 2}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            />
          ))}
        </div>

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.35),transparent_50%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.25),transparent_70%)]" />

        <div className="relative animate-alien-appear">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="h-48 w-48 animate-ping rounded-full border-2 border-cyan-400/30 sm:h-64 sm:w-64 md:h-72 md:w-72" />
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div
              className="h-64 w-64 animate-ping rounded-full border border-purple-400/20 sm:h-80 sm:w-80 md:h-96 md:w-96"
              style={{ animationDelay: "0.5s" }}
            />
          </div>

          <svg
            viewBox="0 0 200 240"
            className="relative h-44 w-44 animate-float drop-shadow-[0_0_40px_rgba(168,85,247,0.8)] xs:h-52 xs:w-52 sm:h-64 sm:w-64 md:h-72 md:w-72 lg:h-80 lg:w-80"
          >
            <defs>
              <radialGradient id="alienBody" cx="50%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#a7f3d0" />
                <stop offset="50%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#059669" />
              </radialGradient>
              <radialGradient id="alienHead" cx="50%" cy="35%" r="60%">
                <stop offset="0%" stopColor="#d1fae5" />
                <stop offset="60%" stopColor="#6ee7b7" />
                <stop offset="100%" stopColor="#10b981" />
              </radialGradient>
              <radialGradient id="eyeGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="70%" stopColor="#000" />
                <stop offset="100%" stopColor="#a855f7" />
              </radialGradient>
              <filter id="alienGlow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <ellipse cx="100" cy="80" rx="70" ry="80" fill="#a855f7" opacity="0.15" filter="url(#alienGlow)" />
            <ellipse cx="100" cy="75" rx="60" ry="55" fill="url(#alienHead)" />
            <ellipse cx="75" cy="80" rx="18" ry="22" fill="url(#eyeGrad)" transform="rotate(-15 75 80)" />
            <ellipse cx="125" cy="80" rx="18" ry="22" fill="url(#eyeGrad)" transform="rotate(15 125 80)" />
            <circle cx="70" cy="72" r="4" fill="#a855f7" opacity="0.9" />
            <circle cx="120" cy="72" r="4" fill="#a855f7" opacity="0.9" />
            <circle cx="80" cy="88" r="2" fill="#22d3ee" opacity="0.8" />
            <circle cx="130" cy="88" r="2" fill="#22d3ee" opacity="0.8" />
            <ellipse cx="100" cy="105" rx="2" ry="3" fill="#065f46" opacity="0.5" />
            <path d="M 90 118 Q 100 125 110 118" stroke="#065f46" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <rect x="90" y="125" width="20" height="15" fill="url(#alienBody)" />
            <ellipse cx="100" cy="170" rx="45" ry="50" fill="url(#alienBody)" />
            <ellipse cx="100" cy="165" rx="15" ry="20" fill="#a855f7" opacity="0.4" filter="url(#alienGlow)" />
            <ellipse cx="55" cy="165" rx="10" ry="28" fill="url(#alienBody)" transform="rotate(20 55 165)" />
            <ellipse cx="145" cy="165" rx="10" ry="28" fill="url(#alienBody)" transform="rotate(-20 145 165)" />
          </svg>

          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-cyan-300"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: `${Math.random() * 4 + 2}px`,
                height: `${Math.random() * 4 + 2}px`,
                animation: `sparkle ${Math.random() * 2 + 1}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 2}s`,
                boxShadow: "0 0 10px rgba(34,211,238,1)",
              }}
            />
          ))}
        </div>

        <div className="relative z-10 mt-6 text-center sm:mt-8">
          <h1 className="font-mono text-4xl font-bold tracking-[0.2em] text-cyan-300 drop-shadow-[0_0_30px_rgba(34,211,238,1)] xs:text-5xl sm:text-6xl md:text-7xl lg:text-8xl">
            {typedText}
            <span className="animate-pulse">_</span>
          </h1>
          <p className="mt-3 font-mono text-[10px] tracking-[0.4em] text-purple-400 sm:text-xs">
            JADOO HAS ARRIVED
          </p>
        </div>

        <button
          onClick={resetScene}
          className="relative z-10 mt-8 rounded-lg border border-cyan-500/60 bg-cyan-950/40 px-5 py-2 text-[9px] tracking-[0.3em] text-cyan-300 transition-all hover:border-cyan-400 hover:bg-cyan-900/60 hover:shadow-[0_0_25px_rgba(34,211,238,0.6)] sm:text-[10px]"
        >
          ◀ RETURN TO TERMINAL
        </button>

        <style>{`
          @keyframes twinkle { 0%,100%{opacity:.2} 50%{opacity:1} }
          @keyframes sparkle {
            0%,100%{opacity:0; transform:scale(0)}
            50%{opacity:1; transform:scale(1)}
          }
        `}</style>
      </main>
    );
  }

  // ═══════════ SCENE: TERMINAL (MAIN) ═══════════
  return (
    <main className="relative min-h-screen w-full overflow-y-auto bg-black font-mono text-cyan-400">
      {/* Starfield */}
      <div className="pointer-events-none fixed inset-0">
        {Array.from({ length: 60 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-cyan-400"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 2 + 1}px`,
              height: `${Math.random() * 2 + 1}px`,
              opacity: Math.random() * 0.7 + 0.2,
              animation: `twinkle ${Math.random() * 3 + 2}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      {/* Grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,1) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(168,85,247,0.15),transparent_50%),radial-gradient(circle_at_70%_70%,rgba(34,211,238,0.15),transparent_50%)]" />
      <div className="pointer-events-none fixed inset-0 z-40 opacity-[0.08] bg-[linear-gradient(transparent_50%,rgba(0,255,255,0.4)_50%)] bg-[length:100%_3px]" />
      <div className="pointer-events-none fixed inset-0 z-40 bg-[radial-gradient(circle_at_center,transparent_60%,rgba(0,0,0,0.9))]" />

      {/* CONTENT */}
      <div className="relative z-10 flex min-h-screen flex-col gap-3 p-3 sm:p-5">
        {/* HEADER */}
        <header className="flex items-center justify-between border-b border-cyan-900/60 pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="relative h-6 w-6 shrink-0">
              <div
                className="absolute inset-0 animate-spin rounded-full border-2 border-dashed border-cyan-500"
                style={{ animationDuration: "6s" }}
              />
              <div
                className="absolute inset-0 animate-spin rounded-full border-2 border-dashed border-purple-500/50"
                style={{ animationDuration: "4s", animationDirection: "reverse" }}
              />
              <div className="absolute inset-2 rounded-full bg-cyan-400/40 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-[10px] font-bold tracking-[0.25em] text-cyan-300 xs:text-xs sm:text-sm">
                HOLO·TERMINAL 3000
              </h1>
              <p className="hidden text-[8px] tracking-[0.4em] text-cyan-700 sm:block">
                ALIEN COMMUNICATION PROTOCOL
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden flex-col items-end sm:flex">
              <span className="text-[8px] tracking-widest text-cyan-700">UPLINK</span>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    className={`h-2.5 w-1 rounded-sm transition-all ${
                      signalStrength / 20 >= n
                        ? "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.9)]"
                        : "bg-cyan-950"
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2.5 w-2.5 rounded-full transition-all ${
                  status.includes("TRANSMITTING")
                    ? "animate-ping bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,1)]"
                    : "animate-pulse bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                }`}
              />
              <span className="text-[9px] tracking-widest text-cyan-500">LIVE</span>
            </div>
          </div>
        </header>

        {/* MAIN — Mobile: single column, radar TOP, buttons center, log bottom */}
        <div className="flex flex-1 flex-col gap-4 lg:grid lg:grid-cols-[1fr_1.4fr_1fr] lg:gap-3">
          
          {/* ═══ RADAR + INFO — TOP on mobile ═══ */}
          <div className="order-1 flex flex-col items-center gap-3 lg:order-1">
            <div className="relative h-24 w-24 shrink-0 xs:h-28 xs:w-28 sm:h-32 sm:w-32 lg:h-36 lg:w-36">
              <div className="absolute inset-0 rounded-full border border-cyan-800" />
              <div className="absolute inset-3 rounded-full border border-cyan-800/70" />
              <div className="absolute inset-6 rounded-full border border-cyan-800/50" />
              <div className="absolute inset-9 rounded-full border border-cyan-800/30" />
              <div className="absolute left-1/2 top-0 h-full w-px bg-cyan-900" />
              <div className="absolute top-1/2 left-0 h-px w-full bg-cyan-900" />
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 0deg, rgba(34,211,238,0.6) 40deg, transparent 60deg)",
                  animation: "spin 3s linear infinite",
                }}
              />
              <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,1)]" />
              <div className="absolute inset-0 animate-ping rounded-full border border-cyan-400/30" />
            </div>

            {/* Info — horizontal row on mobile, stacked on desktop */}
            <div className="grid w-full grid-cols-3 gap-1.5 lg:grid-cols-1">
              <div className="flex flex-col items-center rounded border border-cyan-900/60 bg-cyan-950/30 px-2 py-1 lg:flex-row lg:justify-between">
                <span className="text-[8px] tracking-widest text-cyan-700">FREQ</span>
                <span className="text-[10px] text-cyan-300">
                  {frequency ? `${frequency.toFixed(2)}Hz` : "---"}
                </span>
              </div>
              <div className="flex flex-col items-center rounded border border-cyan-900/60 bg-cyan-950/30 px-2 py-1 lg:flex-row lg:justify-between">
                <span className="text-[8px] tracking-widest text-cyan-700">MODE</span>
                <span className="text-[10px] text-cyan-300">
                  {isPlayingMelody ? "MELODY" : "MANUAL"}
                </span>
              </div>
              <div className="flex flex-col items-center rounded border border-cyan-900/60 bg-cyan-950/30 px-2 py-1 lg:flex-row lg:justify-between">
                <span className="text-[8px] tracking-widest text-cyan-700">STATUS</span>
                <span className="truncate text-[10px] text-cyan-300">
                  {booted ? status : status}
                </span>
              </div>
            </div>
          </div>

          {/* ═══ CENTER: JADOO + Buttons ═══ */}
          <div className="order-2 flex flex-col items-center justify-center gap-3 lg:order-2">
            <div className="text-center">
              <p className="text-[8px] tracking-[0.5em] text-cyan-700">
                UNKNOWN SIGNAL DETECTED
              </p>
              <h2
                className={`text-3xl font-bold tracking-widest transition-all duration-200 xs:text-4xl sm:text-5xl ${
                  activeButton
                    ? "scale-110 text-purple-300 drop-shadow-[0_0_30px_rgba(168,85,247,1)]"
                    : "text-cyan-300 drop-shadow-[0_0_15px_rgba(34,211,238,0.6)]"
                }`}
              >
                JADOO
              </h2>
            </div>

            <canvas
              ref={canvasRef}
              width={400}
              height={50}
              className="h-10 w-full max-w-md rounded border border-cyan-900/60 bg-black/40 sm:h-12"
            />

            <div className="h-1 w-full max-w-md overflow-hidden rounded-full bg-cyan-950/50">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-purple-400 shadow-[0_0_10px_rgba(34,211,238,0.8)] transition-all duration-200"
                style={{ width: `${melodyProgress}%` }}
              />
            </div>

            {/* 🎯 Buttons — BIG and THUMB-FRIENDLY on mobile */}
            <div className="grid w-full max-w-md grid-cols-5 gap-2 xs:gap-2.5 sm:gap-3">
              {buttons.map((button) => {
                const isActive = activeButton === button.id;
                return (
                  <button
                    key={button.id}
                    onClick={() => handlePress(button)}
                    disabled={!booted}
                    className={`
                      group relative flex aspect-square min-h-[60px] flex-col items-center justify-center
                      rounded-xl border-2 text-base font-bold
                      transition-all duration-150 active:scale-90
                      ${
                        isActive
                          ? "scale-95 border-purple-300 bg-gradient-to-br from-purple-500 to-cyan-500 text-black shadow-[0_0_35px_rgba(168,85,247,1)]"
                          : "border-cyan-700 bg-cyan-950/40 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-900/50 hover:shadow-[0_0_20px_rgba(34,211,238,0.5)]"
                      }
                      disabled:opacity-30
                    `}
                  >
                    <span className="text-lg xs:text-xl sm:text-2xl">{button.id}</span>
                    <span className="hidden text-[7px] tracking-widest opacity-70 xs:block">
                      {button.note}
                    </span>
                    {isActive && (
                      <span className="absolute -inset-1 rounded-xl border border-purple-400 animate-ping" />
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={playJadooMelody}
              disabled={isPlayingMelody || !booted}
              className="group relative w-full max-w-md overflow-hidden rounded-lg border border-cyan-500 bg-gradient-to-r from-cyan-950/60 to-purple-950/60 px-4 py-3 text-[9px] font-bold tracking-[0.25em] text-cyan-200 transition-all hover:border-purple-400 hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] disabled:cursor-not-allowed disabled:opacity-40 sm:text-[10px]"
            >
              <span className="relative z-10">
                {isPlayingMelody ? "◉ TRANSMITTING MELODY..." : "▶ PLAY JADOO MELODY"}
              </span>
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            </button>

            <div className="flex w-full max-w-md items-center gap-2">
              <span className="text-[9px] tracking-widest text-cyan-700">VOL</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="flex-1 accent-cyan-500"
              />
              <span className="text-[9px] text-cyan-500">{Math.round(volume * 100)}%</span>
            </div>
          </div>

          {/* ═══ LOG — BOTTOM on mobile ═══ */}
          <div className="order-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-[9px] tracking-[0.3em] text-cyan-700">
                ▸ TRANSMISSION LOG
              </p>
              <span className="text-[8px] text-cyan-800">{log.length}/30</span>
            </div>

            <div
              ref={logRef}
              className="max-h-24 min-h-16 overflow-y-auto rounded-lg border border-cyan-900/60 bg-cyan-950/20 p-2 lg:max-h-40"
            >
              {log.length === 0 ? (
                <p className="text-[9px] text-cyan-900">▸ Awaiting input...</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {log.map((n, i) => (
                    <span
                      key={i}
                      className="rounded border border-cyan-700/60 bg-cyan-900/40 px-1.5 py-0.5 text-[9px] text-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.3)]"
                    >
                      {n}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-cyan-900/60 bg-cyan-950/20 p-2 text-[8px] leading-relaxed text-cyan-700">
              <p>▸ KEYS: B C D E F</p>
              <p>▸ SOURCE: MP3 MODULE</p>
              <p>▸ TARGET: {TARGET_SEQUENCE.length} NOTES</p>
              <p className="text-purple-500">▸ HINT: FOLLOW THE CODE</p>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="flex flex-col items-center gap-1 border-t border-cyan-900/60 pt-2">
          <p className="text-center text-[9px] tracking-[0.3em] text-cyan-600 sm:text-xs">
            Press Keys{" "}
            <span className="font-bold text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,1)]">
              BCFEBCEDBCFEDC
            </span>
          </p>
          <p className="text-center text-[7px] tracking-[0.3em] text-cyan-900 sm:text-[8px]">
            ROHIT MEHRA COMMUNICATION SYSTEM · EST. 2003
          </p>
        </footer>
      </div>

      <style>{`
        @keyframes twinkle { 0%,100%{opacity:.2} 50%{opacity:1} }
        @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
      `}</style>
    </main>
  );
}

export default App;