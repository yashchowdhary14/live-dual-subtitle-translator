import React, { useState, useEffect } from "react";
import { Sparkles, Globe, Download, Settings, Code, HelpCircle, Layout, ArrowRight } from "lucide-react";
import { ExtensionConfig, HistoryItem, SubtitleStyle } from "./types";
import VideoPlayerSimulator from "./components/VideoPlayerSimulator";
import ExtensionPopupSimulator from "./components/ExtensionPopupSimulator";
import SettingsPanelSimulator from "./components/SettingsPanelSimulator";
import CodeExporterHub from "./components/CodeExporterHub";
import HelpAndInstallationGuide from "./components/HelpAndInstallationGuide";

// Initial config for the simulated environment
const initialConfig: ExtensionConfig = {
  isEnabled: true,
  sourceLang: "auto",
  targetLang: "en",
  showOriginal: true,
  translateOnly: false,
  autoDetect: true,
  lowLatencyMode: false,
  apiProvider: "gemini",
  apiKey: "",
  style: {
    font: "system-ui",
    fontSize: 22,
    fontWeight: "bold",
    textColor: "#ffffff",
    bgColor: "#000000",
    bgOpacity: 75,
    position: "above-original",
    offsetY: -5,
    width: 80,
    borderRadius: 8,
    lineSpacing: 1.4,
    translationOpacity: 100,
    shadowEnabled: true
  }
};

export default function App() {
  const [config, setConfig] = useState<ExtensionConfig>(initialConfig);
  const [originalText, setOriginalText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeSubtitleId, setActiveSubtitleId] = useState("");
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // HUD Metrics
  const [latency, setLatency] = useState(120); // in ms
  const [provider, setProvider] = useState("Gemini 3.5 Flash");
  
  // Tab layout
  const [activeTab, setActiveTab] = useState<"code" | "guide">("code");

  // Call the server translation API on subtitle changes
  useEffect(() => {
    if (!originalText) {
      setTranslatedText("");
      return;
    }

    if (!config.isEnabled) {
      setTranslatedText("");
      return;
    }

    const translateSubtitle = async () => {
      setIsTranslating(true);
      const startTime = performance.now();
      
      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: originalText,
            sourceLang: config.sourceLang,
            targetLang: config.targetLang,
            context: history.slice(0, 3).map(h => h.original).join(" | ")
          }),
        });

        const data = await response.json();
        setTranslatedText(data.translatedText);
        setProvider(data.provider || "Gemini 3.5 Flash");
        
        // Calculate actual API request latency
        const endTime = performance.now();
        const actualLatency = endTime - startTime;
        setLatency(actualLatency);

        // Add to history list (simulate extension log)
        const newHistItem: HistoryItem = {
          id: "hist_" + Date.now(),
          timestamp: new Date().toLocaleTimeString(),
          videoTitle: "Episode 4: Black Forest Cake",
          original: originalText,
          translated: data.translatedText,
          sourceLang: config.sourceLang,
          targetLang: config.targetLang
        };
        setHistory((prev) => [newHistItem, ...prev].slice(0, 50));

      } catch (err) {
        console.error("Translation request failed:", err);
        setTranslatedText(`[Translation Error]`);
        setLatency(80);
      } finally {
        setIsTranslating(false);
      }
    };

    // Low latency mode reduces wait delays
    const delay = config.lowLatencyMode ? 50 : 200;
    const timeoutId = setTimeout(translateSubtitle, delay);

    return () => clearTimeout(timeoutId);
  }, [originalText, config.isEnabled, config.sourceLang, config.targetLang, config.lowLatencyMode]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      
      {/* 1. Header Hero section */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-indigo-500/20">
              DUAL
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Live Dual Subtitle Translator
                <span className="text-[10px] font-mono bg-indigo-900/40 text-indigo-300 border border-indigo-800/50 rounded-full px-2.5 py-0.5 font-semibold">
                  M3 Production Code
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Generate, customize, and pack a video dual subtitle overlay extension.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
              <Globe className="h-3.5 w-3.5 text-indigo-400 animate-spin" style={{ animationDuration: "12s" }} />
              API: <strong className="text-emerald-400 font-semibold">Gemini Connected</strong>
            </span>
          </div>
        </div>
      </header>

      {/* 2. Main content container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        
        {/* Intro Alert */}
        <div className="bg-indigo-950/20 border border-indigo-800/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg backdrop-blur-md">
          <div className="flex gap-3">
            <Sparkles className="h-5 w-5 text-indigo-400 flex-shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Chrome Extension Developer Environment
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Test the interactive overlay above original subtitles on simulated platforms, fine-tune layouts, and download the full workspace bundle!
              </p>
            </div>
          </div>
          <a
            href="#workspace"
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 shrink-0 group transition"
          >
            Go to Source Code
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition" />
          </a>
        </div>

        {/* Top Sandbox Bento Block (Simulator & Popup controller) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Player (Span 8) */}
          <div className="lg:col-span-8 h-full">
            <VideoPlayerSimulator
              config={config}
              translatedText={translatedText}
              originalText={originalText}
              isTranslating={isTranslating}
              onSubtitleChange={setOriginalText}
              activeSubtitleId={activeSubtitleId}
              setActiveSubtitleId={setActiveSubtitleId}
              playbackTime={playbackTime}
              setPlaybackTime={setPlaybackTime}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
            />
          </div>

          {/* Right Column: iOS Popup Controller (Span 4) */}
          <div className="lg:col-span-4 h-full flex items-center justify-center">
            <ExtensionPopupSimulator
              config={config}
              setConfig={setConfig}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              latency={latency}
              detectedLang={originalText ? "German" : "Auto Detect"}
              provider={provider}
            />
          </div>
        </div>

        {/* Middle Settings & Customizations Dashboard */}
        <SettingsPanelSimulator
          config={config}
          setConfig={setConfig}
          history={history}
          setHistory={setHistory}
        />

        {/* Bottom Workspace: Real Code Exporter & Installation Tutorial */}
        <div className="flex flex-col gap-4 mt-4 scroll-mt-24" id="workspace">
          <div className="flex items-center justify-between border-b border-slate-850 pb-2">
            <div className="flex items-center gap-2">
              <Code className="h-5 w-5 text-indigo-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Source Code Hub & Installer
              </h2>
            </div>

            <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800">
              <button
                onClick={() => setActiveTab("code")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  activeTab === "code"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Code Explorer
              </button>
              <button
                onClick={() => setActiveTab("guide")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  activeTab === "guide"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Installation Manual
              </button>
            </div>
          </div>

          {activeTab === "code" ? <CodeExporterHub /> : <HelpAndInstallationGuide />}
        </div>

      </main>

      {/* 3. Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 Live Dual Subtitle Translator. All generated code is Manifest V3 production-ready.</p>
        </div>
      </footer>

    </div>
  );
}
