import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Volume2, Globe, Sparkles, Sliders, Type } from "lucide-react";
import { ExtensionConfig, MockSubtitle } from "../types";

interface VideoPlayerSimulatorProps {
  config: ExtensionConfig;
  translatedText: string;
  originalText: string;
  isTranslating: boolean;
  onSubtitleChange: (text: string) => void;
  activeSubtitleId: string;
  setActiveSubtitleId: (id: string) => void;
  playbackTime: number;
  setPlaybackTime: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
}

export const mockSubtitles: MockSubtitle[] = [
  { id: "1", start: 1, end: 5, text: "Herzlich willkommen zu unserem heutigen Kochabenteuer!" },
  { id: "2", start: 6, end: 10, text: "Heute werden wir eine traditionelle Schwarzwälder Kirschtorte backen." },
  { id: "3", start: 11, end: 15, text: "Zuerst schlagen wir die Eier mit dem Zucker schaumig." },
  { id: "4", start: 16, end: 20, text: "Achten Sie darauf, dass die Schüssel absolut sauber ist." },
  { id: "5", start: 21, end: 25, text: "Danach heben wir das gesiebte Mehl und Backpulver vorsichtig unter." },
  { id: "6", start: 26, end: 30, text: "Das duftet jetzt schon absolut fantastisch!" },
  { id: "7", start: 31, end: 35, text: "Viel Spaß beim Ausprobieren und guten Appetit!" }
];

export default function VideoPlayerSimulator({
  config,
  translatedText,
  originalText,
  isTranslating,
  onSubtitleChange,
  activeSubtitleId,
  setActiveSubtitleId,
  playbackTime,
  setPlaybackTime,
  isPlaying,
  setIsPlaying
}: VideoPlayerSimulatorProps) {
  
  const [platform, setPlatform] = useState<"youtube" | "netflix" | "generic">("youtube");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const maxDuration = 36; // seconds

  // Handle Playback ticker
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setPlaybackTime((prev) => {
          if (prev >= maxDuration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.25; // update every 250ms
        });
      }, 250);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, setPlaybackTime, setIsPlaying]);

  // Sync subtitles based on playbackTime
  useEffect(() => {
    const currentSub = mockSubtitles.find(
      (sub) => playbackTime >= sub.start && playbackTime <= sub.end
    );

    if (currentSub) {
      if (currentSub.id !== activeSubtitleId) {
        setActiveSubtitleId(currentSub.id);
        onSubtitleChange(currentSub.text);
      }
    } else {
      if (activeSubtitleId !== "") {
        setActiveSubtitleId("");
        onSubtitleChange("");
      }
    }
  }, [playbackTime, activeSubtitleId, setActiveSubtitleId, onSubtitleChange]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlaybackTime(parseFloat(e.target.value));
  };

  const getStyleObject = () => {
    const style = config.style;
    const r = parseInt(style.bgColor.slice(1, 3), 16) || 0;
    const g = parseInt(style.bgColor.slice(3, 5), 16) || 0;
    const b = parseInt(style.bgColor.slice(5, 7), 16) || 0;
    const opacity = style.bgOpacity / 100;

    return {
      fontFamily: style.font === "SF Pro Text" ? "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" : style.font,
      fontSize: `${style.fontSize}px`,
      fontWeight: style.fontWeight as any,
      color: style.textColor,
      backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity})`,
      borderRadius: `${style.borderRadius}px`,
      lineHeight: style.lineSpacing,
      textShadow: style.shadowEnabled
        ? "1px 1px 3px rgba(0,0,0,0.85), -1px -1px 3px rgba(0,0,0,0.85)"
        : "none",
      width: `${style.width}%`,
      opacity: config.isEnabled ? 1 : 0.4,
      transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
    };
  };

  const getVerticalPlacementClass = () => {
    const pos = config.style.position;
    if (pos === "top") return "top-8 justify-start";
    if (pos === "middle") return "top-1/2 -translate-y-1/2 justify-center";
    if (pos === "above-original") return "bottom-24 justify-end";
    return "bottom-14 justify-end"; // bottom
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative flex flex-col h-full group" id="player-container">
      {/* Platform Switcher & Metadata */}
      <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-mono text-slate-400 font-semibold uppercase tracking-wider">
            Subtitle Sandbox Simulator
          </span>
        </div>

        <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800">
          <button
            onClick={() => setPlatform("youtube")}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
              platform === "youtube"
                ? "bg-red-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            YouTube
          </button>
          <button
            onClick={() => setPlatform("netflix")}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
              platform === "netflix"
                ? "bg-red-700 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Netflix
          </button>
          <button
            onClick={() => setPlatform("generic")}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
              platform === "generic"
                ? "bg-slate-750 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Generic
          </button>
        </div>
      </div>

      {/* Video Content Canvas */}
      <div className="relative flex-1 bg-slate-950 flex items-center justify-center min-h-[340px] select-none overflow-hidden">
        
        {/* Immersive Moving Landscape Animation representing Video Playing */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950/40 via-purple-950/20 to-blue-950/30"></div>
          
          {/* Animated stars/particles that shift when playing */}
          <div className={`absolute inset-0 transition-all duration-1000 ${isPlaying ? "animate-pulse" : ""}`}>
            <div className="absolute top-[20%] left-[10%] w-32 h-32 bg-purple-500/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-[30%] right-[15%] w-44 h-44 bg-blue-500/10 rounded-full blur-3xl"></div>
          </div>

          {/* Interactive Cooking Stage Graphic since we simulate a cooking video */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-slate-900/60 flex flex-col justify-end items-center pb-6">
            <div className="text-center">
              <span className="text-[10px] uppercase tracking-widest text-indigo-400/80 font-semibold">
                Cooking Class Series
              </span>
              <h4 className="text-xs font-medium text-slate-300">
                Episode 4: Perfecting the Black Forest Cake
              </h4>
            </div>
          </div>
        </div>

        {/* Real-time Subtitle Overlay Render Container */}
        {(originalText || translatedText) && (
          <div className={`absolute inset-x-0 p-4 flex flex-col items-center pointer-events-none ${getVerticalPlacementClass()}`}>
            
            {/* Overlay Box matching User Styling Preferences */}
            <div style={getStyleObject()} className="flex flex-col items-center gap-2 p-3 text-center">
              
              {/* Translated Text (Renders On Top in Dual Mode) */}
              {config.isEnabled && translatedText && (
                <div 
                  style={{ opacity: config.style.translationOpacity / 100 }}
                  className="font-semibold text-center select-none"
                >
                  {isTranslating ? (
                    <span className="inline-flex items-center gap-1.5 opacity-80 text-sm">
                      <Sparkles className="h-3.5 w-3.5 animate-spin text-amber-400" />
                      Translating subtitle via Gemini...
                    </span>
                  ) : (
                    translatedText
                  )}
                </div>
              )}

              {/* original segment (Renders below translated, separated by line) */}
              {config.showOriginal && !config.translateOnly && originalText && (
                <div className="text-slate-300 text-sm opacity-85 border-t border-slate-400/20 pt-1.5 w-full text-center">
                  {originalText}
                </div>
              )}

            </div>
          </div>
        )}

        {/* Standard Video Player Controls Overlay on Hover */}
        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="h-16 w-16 bg-slate-900/90 text-white rounded-full flex items-center justify-center hover:bg-slate-800 hover:scale-105 active:scale-95 transition shadow-2xl border border-slate-700/50"
          >
            {isPlaying ? <Pause className="h-8 w-8 text-indigo-400" /> : <Play className="h-8 w-8 fill-indigo-400 text-indigo-400 ml-1" />}
          </button>
        </div>

        {/* Translation Indicator HUD in top right corner */}
        {config.isEnabled && isPlaying && (
          <div className="absolute top-4 right-4 bg-slate-900/95 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs text-slate-300 shadow-xl z-20 backdrop-blur-md">
            <Globe className="h-3.5 w-3.5 text-blue-400 animate-spin" style={{ animationDuration: "6s" }} />
            <span>Dual Translated: {config.sourceLang === "auto" ? "Detect" : config.sourceLang} → {config.targetLang.toUpperCase()}</span>
          </div>
        )}
      </div>

      {/* Video Progress Bar & Player HUD */}
      <div className="bg-slate-950 p-4 border-t border-slate-800 flex flex-col gap-3">
        {/* Slider Timeline */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400 w-10 text-right">
            {formatTime(playbackTime)}
          </span>
          <input
            type="range"
            min="0"
            max={maxDuration}
            step="0.1"
            value={playbackTime}
            onChange={handleSeek}
            className="flex-1 accent-indigo-500 h-1 rounded-lg bg-slate-800 cursor-pointer outline-none"
          />
          <span className="text-xs font-mono text-slate-400 w-10">
            {formatTime(maxDuration)}
          </span>
        </div>

        {/* Playback Actions Panel */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-slate-400" />}
            </button>
            <button
              onClick={() => {
                setIsPlaying(false);
                setPlaybackTime(0);
              }}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition"
              title="Reset Video"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <div className="h-4 w-px bg-slate-800 mx-1"></div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Volume2 className="h-4 w-4" />
              <div className="h-1 w-12 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full w-4/5 bg-slate-400"></div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
            <span>Video Resolution: 1080p60</span>
            <span className="h-1 w-1 rounded-full bg-slate-700"></span>
            <span>Codec: VP09</span>
          </div>
        </div>
      </div>
    </div>
  );
}
