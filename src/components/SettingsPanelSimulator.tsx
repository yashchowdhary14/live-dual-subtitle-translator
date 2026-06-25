import React from "react";
import { Sliders, Type, Layout, History, Trash2, Eye, HelpCircle } from "lucide-react";
import { ExtensionConfig, HistoryItem } from "../types";

interface SettingsPanelSimulatorProps {
  config: ExtensionConfig;
  setConfig: React.Dispatch<React.SetStateAction<ExtensionConfig>>;
  history: HistoryItem[];
  setHistory: (history: HistoryItem[]) => void;
}

export default function SettingsPanelSimulator({
  config,
  setConfig,
  history,
  setHistory
}: SettingsPanelSimulatorProps) {
  
  const handleStyleChange = (key: string, value: any) => {
    setConfig((prev) => ({
      ...prev,
      style: {
        ...prev.style,
        [key]: value,
      },
    }));
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setConfig((prev) => ({
      ...prev,
      apiProvider: e.target.value as any,
    }));
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prev) => ({
      ...prev,
      apiKey: e.target.value,
    }));
  };

  const clearHistory = () => {
    setHistory([]);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col gap-6 p-6 text-slate-100">
      
      {/* 1. API Configuration Section */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <Sliders className="h-4 w-4 text-indigo-400" />
          Translation API Configuration
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-850">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">Translation Engine</label>
            <select
              value={config.apiProvider}
              onChange={handleProviderChange}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="gemini">Gemini 3.5 Flash Model (Default Proxy)</option>
              <option value="google">Google Translate API (No Keys Required)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">Custom Provider API Key (Optional)</label>
            <input
              type="password"
              placeholder="API Key is secure on Server backend..."
              value={config.apiKey}
              onChange={handleApiKeyChange}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* 2. Custom Typography and Style Dashboard */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <Type className="h-4 w-4 text-amber-400" />
          Custom Overlay Typography & Style
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-850">
          {/* Font Family selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">Font Style</label>
            <select
              value={config.style.font}
              onChange={(e) => handleStyleChange("font", e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="system-ui">Inter (System Default)</option>
              <option value="JetBrains Mono">JetBrains Mono</option>
              <option value="Georgia">Georgia (Editorial Serif)</option>
              <option value="Impact">Impact (Heavy Sans)</option>
            </select>
          </div>

          {/* Font Size selection */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">Font Size (px)</label>
            <input
              type="number"
              min="14"
              max="42"
              value={config.style.fontSize}
              onChange={(e) => handleStyleChange("fontSize", parseInt(e.target.value) || 20)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
            />
          </div>

          {/* Text color selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">Text Hex Color</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={config.style.textColor}
                onChange={(e) => handleStyleChange("textColor", e.target.value)}
                className="h-8 w-8 bg-transparent border-0 rounded cursor-pointer"
              />
              <input
                type="text"
                value={config.style.textColor}
                onChange={(e) => handleStyleChange("textColor", e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none focus:border-indigo-500 w-full"
              />
            </div>
          </div>

          {/* Background opacity slider */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs font-semibold text-slate-400">
              <label>Background Opacity</label>
              <span>{config.style.bgOpacity}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.style.bgOpacity}
              onChange={(e) => handleStyleChange("bgOpacity", parseInt(e.target.value))}
              className="accent-indigo-500 mt-2.5"
            />
          </div>
        </div>
      </div>

      {/* 3. Positioning and Sizing controls */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <Layout className="h-4 w-4 text-emerald-400" />
          Overlay Layout & Placement
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-850">
          
          {/* Vertical Position placement */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">Vertical Position</label>
            <select
              value={config.style.position}
              onChange={(e) => handleStyleChange("position", e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="above-original">Above Original Caption (Best)</option>
              <option value="top">Top Header Overlay</option>
              <option value="middle">Center Screen</option>
              <option value="bottom">Bottom Overlay</option>
            </select>
          </div>

          {/* Horizontal Width percentage */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs font-semibold text-slate-400">
              <label>Max Text Width</label>
              <span>{config.style.width}%</span>
            </div>
            <input
              type="range"
              min="40"
              max="100"
              step="5"
              value={config.style.width}
              onChange={(e) => handleStyleChange("width", parseInt(e.target.value))}
              className="accent-indigo-500 mt-2.5"
            />
          </div>

          {/* Border radius */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">Border Smoothness (px)</label>
            <input
              type="number"
              min="0"
              max="24"
              value={config.style.borderRadius}
              onChange={(e) => handleStyleChange("borderRadius", parseInt(e.target.value) || 0)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500"
            />
          </div>

          {/* Shadow toggle */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">Text Contrast Shadow</label>
            <div className="flex items-center gap-3 mt-1.5">
              <input
                type="checkbox"
                id="shadow-toggle"
                checked={config.style.shadowEnabled}
                onChange={(e) => handleStyleChange("shadowEnabled", e.target.checked)}
                className="h-4 w-4 text-indigo-600 bg-slate-900 border-slate-800 rounded accent-indigo-500 cursor-pointer"
              />
              <label htmlFor="shadow-toggle" className="text-xs text-slate-300 font-medium cursor-pointer">
                High Contrast Outer Shadow
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Live Translation History Logs */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <History className="h-4 w-4 text-indigo-400" />
            Live Translation Session Logs
          </h3>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-slate-500 hover:text-red-400 text-xs flex items-center gap-1 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear Logs
            </button>
          )}
        </div>

        <div className="bg-slate-950/50 rounded-xl border border-slate-850 overflow-hidden max-h-56 overflow-y-auto">
          {history.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No live subtitles captured yet. Play the video simulator above to trigger real-time AI translations!
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-slate-850">
              {history.map((item) => (
                <div key={item.id} className="p-3 text-xs flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>Captured Subtitle segment - {item.timestamp}</span>
                    <span className="text-indigo-400">Auto ({item.sourceLang === "auto" ? "Detect" : item.sourceLang}) → {item.targetLang.toUpperCase()}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 mt-1">
                    <div className="flex-1 bg-slate-900/60 p-2 rounded border border-slate-800 font-medium text-slate-300">
                      <span className="text-[9px] uppercase text-slate-500 font-bold block mb-0.5 font-mono">Original</span>
                      "{item.original}"
                    </div>
                    <div className="flex-1 bg-indigo-950/20 p-2 rounded border border-indigo-900/30 font-semibold text-indigo-200">
                      <span className="text-[9px] uppercase text-indigo-400/80 font-bold block mb-0.5 font-mono">Translation Overlay</span>
                      "{item.translated}"
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
