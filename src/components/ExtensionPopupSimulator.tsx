import React from "react";
import { Check, Info, Settings, Trash2, Zap, Play, Pause, RefreshCw } from "lucide-react";
import { ExtensionConfig } from "../types";

interface ExtensionPopupSimulatorProps {
  config: ExtensionConfig;
  setConfig: React.Dispatch<React.SetStateAction<ExtensionConfig>>;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  latency: number;
  detectedLang: string;
  provider: string;
}

export default function ExtensionPopupSimulator({
  config,
  setConfig,
  isPlaying,
  setIsPlaying,
  latency,
  detectedLang,
  provider
}: ExtensionPopupSimulatorProps) {
  
  const handleToggleActive = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prev) => ({ ...prev, isEnabled: e.target.checked }));
  };

  const handleSourceLangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setConfig((prev) => ({ 
      ...prev, 
      sourceLang: e.target.value,
      autoDetect: e.target.value === "auto"
    }));
  };

  const handleTargetLangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setConfig((prev) => ({ ...prev, targetLang: e.target.value }));
  };

  const handleOptionChange = (key: keyof ExtensionConfig, val: boolean) => {
    setConfig((prev) => {
      const next = { ...prev, [key]: val };
      if (key === "translateOnly" && val) {
        next.showOriginal = false;
      } else if (key === "showOriginal" && val) {
        next.translateOnly = false;
      }
      return next;
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl w-full max-w-[340px] mx-auto flex flex-col font-sans text-slate-100">
      {/* Extension Header */}
      <div className="bg-slate-950 px-4 py-3.5 border-b border-slate-850 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-xs shadow-md text-white">
            Dual
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-white leading-none">Dual Subtitle API</h3>
            <span className="text-[10px] text-slate-400 font-medium">Manifest V3 Extension</span>
          </div>
        </div>
        
        {/* Toggle Switch */}
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.isEnabled}
            onChange={handleToggleActive}
            className="sr-only peer"
          />
          <div className="w-10 h-6 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
        </label>
      </div>

      {/* Main Form Fields */}
      <div className="p-4 flex flex-col gap-4">
        {/* Languages Selection block */}
        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
            Language Settings
          </span>
          <div className="flex flex-col gap-2.5 bg-slate-950/50 p-3 rounded-xl border border-slate-850">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">Original Audio</label>
              <select
                value={config.sourceLang}
                onChange={handleSourceLangChange}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none w-32 focus:border-indigo-500"
              >
                <option value="auto">Auto Detect</option>
                <option value="German">German</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="Hindi">Hindi</option>
                <option value="Japanese">Japanese</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">Translate To</label>
              <select
                value={config.targetLang}
                onChange={handleTargetLangChange}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none w-32 focus:border-indigo-500"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="hi">Hindi</option>
                <option value="German">German</option>
              </select>
            </div>
          </div>
        </div>

        {/* Translation Option Toggles */}
        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
            Overlay Mode
          </span>
          <div className="flex flex-col gap-2.5 bg-slate-950/50 p-3 rounded-xl border border-slate-850">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium">Show Original Captions</span>
              <input
                type="checkbox"
                checked={config.showOriginal}
                onChange={(e) => handleOptionChange("showOriginal", e.target.checked)}
                className="rounded text-indigo-600 bg-slate-900 border-slate-800 h-4 w-4 accent-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium">Translate Only (Hide Orig)</span>
              <input
                type="checkbox"
                checked={config.translateOnly}
                onChange={(e) => handleOptionChange("translateOnly", e.target.checked)}
                className="rounded text-indigo-600 bg-slate-900 border-slate-800 h-4 w-4 accent-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between border-t border-slate-850 pt-2 mt-1">
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs text-slate-300 font-medium">Low Latency Mode</span>
              </div>
              <input
                type="checkbox"
                checked={config.lowLatencyMode}
                onChange={(e) => handleOptionChange("lowLatencyMode", e.target.checked)}
                className="rounded text-indigo-600 bg-slate-900 border-slate-800 h-4 w-4 accent-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Video Actions inside Popup */}
        <div className="flex gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition ${
              isPlaying
                ? "bg-amber-600 text-white hover:bg-amber-500"
                : "bg-indigo-600 text-white hover:bg-indigo-500"
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="h-3.5 w-3.5" />
                Pause Video
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-white" />
                Play Video
              </>
            )}
          </button>
        </div>
      </div>

      {/* Footer Metrics */}
      <div className="bg-slate-950 px-4 py-3 border-t border-slate-850 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
          <span>Engine: {provider}</span>
        </div>
        <div className="text-right">
          <span>Latency: {isFinite(latency) ? `<${Math.round(latency)}ms` : "Seeking..."}</span>
        </div>
      </div>
    </div>
  );
}
