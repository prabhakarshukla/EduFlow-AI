"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../../../lib/supabase";
import { useRouter } from "next/navigation";
import FocusStats from "../../../components/FocusStats";

type SessionType = "focus" | "short_break" | "long_break";

// Sound options with local MP3 files (downloaded from Pixabay for robust offline access)
const AMBIENT_SOUNDS = [
  { id: "rain", label: "Rain", url: "/sounds/gentle-rain.mp3" },
  { id: "jazz", label: "Jazz", url: "/sounds/jazz.mp3" },
  { id: "nature", label: "Nature", url: "/sounds/nature-ambiance.mp3" },
];

export default function FocusModePage() {
  const router = useRouter();
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Timer Settings
  const [durations, setDurations] = useState({
    focus: 25 * 60,
    short_break: 5 * 60,
    long_break: 15 * 60,
  });
  
  // Timer State
  const [phase, setPhase] = useState<SessionType>("focus");
  const [timeLeft, setTimeLeft] = useState(durations.focus);
  const [isRunning, setIsRunning] = useState(false);
  const [completedCycles, setCompletedCycles] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  
  // Audio State
  const [activeSound, setActiveSound] = useState<string | null>(null);
  const [isPlayingSound, setIsPlayingSound] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayError = (e: any) => {
    setIsPlayingSound(false);
    setActiveSound(null);
  };

  const handleSoundToggle = (soundId: string) => {
    if (activeSound === soundId) {
      if (isPlayingSound) {
        setIsPlayingSound(false);
        audioRef.current?.pause();
      } else {
        setIsPlayingSound(true);
        const playPromise = audioRef.current?.play();
        if (playPromise !== undefined) {
          playPromise.catch(handlePlayError);
        }
      }
    } else {
      setActiveSound(soundId);
      setIsPlayingSound(true);
      const sound = AMBIENT_SOUNDS.find(s => s.id === soundId);
      if (sound && audioRef.current) {
        audioRef.current.src = sound.url;
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(handlePlayError);
        }
      }
    }
  };

  const togglePlayPause = () => {
    if (!activeSound) {
      handleSoundToggle(AMBIENT_SOUNDS[0].id);
      return;
    }
    if (isPlayingSound) {
      setIsPlayingSound(false);
      audioRef.current?.pause();
    } else {
      setIsPlayingSound(true);
      const playPromise = audioRef.current?.play();
      if (playPromise !== undefined) {
        playPromise.catch(handlePlayError);
      }
    }
  };

  // Stats refresh trigger
  const [statsKey, setStatsKey] = useState(0);

  // Initialize from LocalStorage
  useEffect(() => {
    const savedState = localStorage.getItem("focus_session_state");
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        const { savedAt, timeLeft: savedTimeLeft, phase: savedPhase, isRunning: savedIsRunning, sessionStartTime: savedStartTime, completedCycles: savedCycles } = parsed;
        
        const now = Date.now();
        const elapsed = Math.floor((now - savedAt) / 1000);
        
        let newTimeLeft = savedTimeLeft;
        if (savedIsRunning) {
          newTimeLeft = Math.max(0, savedTimeLeft - elapsed);
        }
        
        setPhase(savedPhase);
        setTimeLeft(newTimeLeft);
        setIsRunning(savedIsRunning && newTimeLeft > 0);
        setSessionStartTime(savedStartTime);
        setCompletedCycles(savedCycles);
        
        if (savedIsRunning && newTimeLeft === 0) {
          handleSessionComplete(savedPhase, savedStartTime, savedTimeLeft, savedCycles);
        }
      } catch (e) {
        console.error("Failed to restore focus session state", e);
      }
    } else {
      setTimeLeft(durations[phase]);
    }
  }, []);

  // Save to LocalStorage whenever state changes
  useEffect(() => {
    if (isRunning) {
      localStorage.setItem("focus_session_state", JSON.stringify({
        savedAt: Date.now(),
        timeLeft,
        phase,
        isRunning,
        sessionStartTime,
        completedCycles
      }));
    } else {
      localStorage.removeItem("focus_session_state");
    }
  }, [timeLeft, phase, isRunning, sessionStartTime, completedCycles]);

  const handleSessionComplete = async (completedPhase: SessionType, startTimeMs: number | null, expectedDuration: number, cycles: number) => {
    setIsRunning(false);
    
    // Play completion chime (placeholder simple beep)
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
    oscillator.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.5);

    // Save to DB
    if (startTimeMs) {
      const actualDuration = Math.min(expectedDuration, Math.floor((Date.now() - startTimeMs) / 1000));
      await saveSessionToDB(completedPhase, new Date(startTimeMs), "completed", actualDuration, cycles);
    }
    
    // Auto transition to next phase UI but don't start
    let nextPhase: SessionType = "focus";
    let nextCycles = cycles;
    
    if (completedPhase === "focus") {
      nextCycles += 1;
      if (nextCycles % 4 === 0) {
        nextPhase = "long_break";
      } else {
        nextPhase = "short_break";
      }
    } else {
      nextPhase = "focus";
    }
    
    setPhase(nextPhase);
    setCompletedCycles(nextCycles);
    setTimeLeft(durations[nextPhase]);
    setSessionStartTime(null);
  };

  const handleInterrupt = async () => {
    setIsRunning(false);
    if (sessionStartTime) {
      const elapsed = durations[phase] - timeLeft;
      if (elapsed > 10) { // Only save if more than 10s elapsed
        await saveSessionToDB(phase, new Date(sessionStartTime), "interrupted", elapsed, completedCycles);
      }
    }
    setSessionStartTime(null);
    setTimeLeft(durations[phase]);
  };

  const saveSessionToDB = async (sessionPhase: SessionType, start: Date, status: "completed" | "interrupted", durationSec: number, cycles: number) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      
      await supabase.from("focus_sessions").insert({
        user_id: userData.user.id,
        start_time: start.toISOString(),
        end_time: new Date().toISOString(),
        duration: durationSec,
        session_type: sessionPhase,
        completion_status: status,
        completed_cycles: cycles,
      });
      setStatsKey(prev => prev + 1); // Refresh stats
    } catch (e) {
      console.error("Failed to save session", e);
    }
  };

  // Timer Tick
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleSessionComplete(phase, sessionStartTime, durations[phase], completedCycles);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft, phase, sessionStartTime, durations, completedCycles]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      
      if (e.code === "Space") {
        e.preventDefault();
        toggleTimer();
      } else if (e.code === "Escape") {
        if (!document.fullscreenElement) {
          exitFocusMode();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRunning, timeLeft]);

  // Handle Audio
  // Synchronous play is handled in handleSoundToggle now to bypass Safari/mobile autoplay restrictions.

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Before Unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRunning && sessionStartTime) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isRunning, sessionStartTime]);

  const toggleTimer = () => {
    if (!isRunning) {
      setIsRunning(true);
      if (!sessionStartTime) setSessionStartTime(Date.now());
    } else {
      setIsRunning(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(e => {
        console.error("Fullscreen API not supported", e);
        setIsFullscreen(true); // Fallback to CSS fullscreen
      });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const exitFocusMode = () => {
    if (isRunning && sessionStartTime) {
      if (!window.confirm("You have an active session. Are you sure you want to exit? Your progress will be saved as interrupted.")) {
        return;
      }
      handleInterrupt();
    }
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    router.push("/dashboard");
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--ui-bg)", color: "var(--ui-text)" }}>
      {/* Hidden audio element */}
      <audio ref={audioRef} loop />

      {/* Top Bar */}
      <div className="flex items-center justify-between p-6">
        <button onClick={exitFocusMode} className="text-sm font-medium hover:text-[#14b8a6] transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Exit Focus Mode
        </button>
        <div className="flex gap-4">
          <button onClick={() => setSettingsOpen(true)} className="p-2 rounded-full hover:bg-black/5 transition-colors text-[var(--ui-muted)]" aria-label="Settings">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
          <button onClick={toggleFullscreen} className="p-2 rounded-full hover:bg-black/5 transition-colors text-[var(--ui-muted)]" aria-label="Fullscreen">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row p-6 md:p-12 gap-12 overflow-y-auto">
        {/* Left Sidebar: Stats */}
        <div className="w-full lg:w-80 flex flex-col gap-6 order-2 lg:order-1">
          <div className="bg-[var(--ui-surface)] border border-[var(--ui-border)] p-6 rounded-2xl shadow-sm flex-1">
            <h3 className="font-bold text-[#14b8a6] mb-4 flex items-center gap-2 tracking-wide">
              <svg className="w-4 h-4 text-[#14b8a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              FOCUS STATISTICS
            </h3>
            <FocusStats key={statsKey} />
          </div>
        </div>

        {/* Main Timer Area */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] order-1 lg:order-2">
          <div className="flex gap-4 mb-8 bg-[var(--ui-surface)] p-1.5 rounded-2xl border border-[var(--ui-border)] shadow-sm">
            {(["focus", "short_break", "long_break"] as const).map(p => (
              <button 
                key={p} 
                onClick={() => {
                  if (isRunning && !window.confirm("Interrupt current session?")) return;
                  handleInterrupt();
                  setPhase(p);
                  setTimeLeft(durations[p]);
                }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${phase === p ? 'bg-[#14b8a6] text-white shadow-md' : 'text-[var(--ui-muted)] hover:text-[var(--ui-text)]'}`}
              >
                {p === "focus" ? "Focus" : p === "short_break" ? "Short Break" : "Long Break"}
              </button>
            ))}
          </div>

          <div className="text-[120px] sm:text-[160px] font-bold leading-none tracking-tight mb-12 font-mono tabular-nums" style={{ color: phase === "focus" ? "#14b8a6" : "#6366f1" }}>
            {formatTime(timeLeft)}
          </div>

          <div className="flex gap-6">
            <button 
              onClick={toggleTimer} 
              className="w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 active:scale-95 transition-all"
              style={{ background: isRunning ? "#ef4444" : "#14b8a6" }}
            >
              {isRunning ? (
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg className="w-8 h-8 ml-2" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>
            
            {(!isRunning && timeLeft < durations[phase]) && (
              <button 
                onClick={() => {
                  if (window.confirm("Reset timer? Session will be saved as interrupted.")) {
                    handleInterrupt();
                  }
                }}
                className="w-20 h-20 rounded-full flex items-center justify-center shadow-md bg-[var(--ui-surface)] text-[var(--ui-muted)] hover:scale-105 active:scale-95 transition-all border border-[var(--ui-border)]"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
            )}
          </div>
          
          <div className="mt-8 text-sm font-medium" style={{ color: "var(--ui-muted)" }}>
            Cycle: {(completedCycles % 4) + 1} / 4
          </div>
        </div>

        {/* Right Sidebar: Ambience */}
        <div className="w-full lg:w-80 flex flex-col gap-6 order-3 lg:order-3">
          <div className="bg-[var(--ui-surface)] border border-[var(--ui-border)] p-6 rounded-2xl shadow-sm">
            <h3 className="font-bold text-[#14b8a6] mb-4 flex items-center gap-2 tracking-wide">
              <svg className="w-4 h-4 text-[#14b8a6]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
              AMBIENT SOUNDS
            </h3>
            <div className="space-y-3">
              {AMBIENT_SOUNDS.map(s => (
                <button 
                  key={s.id} 
                  onClick={() => handleSoundToggle(s.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${activeSound === s.id ? 'border-[#14b8a6] bg-[#14b8a6]/10 text-[#14b8a6]' : 'border-[var(--ui-border)] hover:bg-[var(--ui-hover)]'}`}
                >
                  <span className="text-sm font-medium">{s.label}</span>
                  {activeSound === s.id && isPlayingSound && (
                    <div className="flex gap-1">
                      <span className="w-1 h-3 bg-[#14b8a6] animate-pulse rounded-full"></span>
                      <span className="w-1 h-4 bg-[#14b8a6] animate-pulse rounded-full" style={{ animationDelay: '100ms' }}></span>
                      <span className="w-1 h-2 bg-[#14b8a6] animate-pulse rounded-full" style={{ animationDelay: '200ms' }}></span>
                    </div>
                  )}
                </button>
              ))}
            </div>
            
            <div className="mt-6 flex flex-col gap-4">
              <div className="flex items-center justify-center">
                <button 
                  onClick={togglePlayPause} 
                  className="w-12 h-12 rounded-full flex items-center justify-center shadow-md bg-[var(--ui-surface)] text-[var(--ui-text)] hover:scale-105 active:scale-95 transition-all border border-[var(--ui-border)]"
                  title={isPlayingSound ? "Pause Sound" : "Play Sound"}
                >
                  {isPlayingSound ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                  ) : (
                    <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  )}
                </button>
              </div>

              {activeSound && (
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-[var(--ui-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                  <input 
                    type="range" 
                    min="0" max="1" step="0.05" 
                    value={volume} 
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-full accent-[#14b8a6]"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[var(--ui-surface)] border border-[var(--ui-border)] p-6 rounded-2xl w-full max-w-sm">
            <h2 className="text-xl font-bold mb-4">Timer Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--ui-muted)]">Focus (minutes)</label>
                <input type="number" value={durations.focus / 60} onChange={(e) => setDurations({...durations, focus: parseInt(e.target.value) * 60})} className="w-full bg-[var(--ui-bg)] border border-[var(--ui-border)] rounded-lg p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--ui-muted)]">Short Break (minutes)</label>
                <input type="number" value={durations.short_break / 60} onChange={(e) => setDurations({...durations, short_break: parseInt(e.target.value) * 60})} className="w-full bg-[var(--ui-bg)] border border-[var(--ui-border)] rounded-lg p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--ui-muted)]">Long Break (minutes)</label>
                <input type="number" value={durations.long_break / 60} onChange={(e) => setDurations({...durations, long_break: parseInt(e.target.value) * 60})} className="w-full bg-[var(--ui-bg)] border border-[var(--ui-border)] rounded-lg p-2" />
              </div>
            </div>
            
            <div className="mt-6 flex gap-3">
              <button onClick={() => setSettingsOpen(false)} className="flex-1 px-4 py-2 bg-[var(--ui-hover)] rounded-lg font-medium">Cancel</button>
              <button onClick={() => {
                setSettingsOpen(false);
                if (!isRunning) setTimeLeft(durations[phase]);
              }} className="flex-1 px-4 py-2 bg-[#14b8a6] text-white rounded-lg font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
