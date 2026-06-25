import React from "react";
import { BookOpen, HelpCircle, CheckCircle, Code, Shield, Cpu, RefreshCw } from "lucide-react";

export default function HelpAndInstallationGuide() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6 text-slate-200">
      
      {/* Installation title */}
      <div>
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-indigo-400" />
          Extension Installation & Deployment Guide
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Learn how to load your custom dual subtitle translator directly into Google Chrome in seconds.
        </p>
      </div>

      {/* Steps Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 flex flex-col gap-2">
          <div className="h-6 w-6 bg-indigo-950 text-indigo-400 rounded-full flex items-center justify-center font-bold text-xs">
            1
          </div>
          <h4 className="text-sm font-semibold text-white">Download Codebase</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Click the <strong className="text-indigo-400">"Get ZIP"</strong> button in the Extension Explorer to download the unpacked codebase containing the complete Manifest V3 setup.
          </p>
        </div>

        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 flex flex-col gap-2">
          <div className="h-6 w-6 bg-indigo-950 text-indigo-400 rounded-full flex items-center justify-center font-bold text-xs">
            2
          </div>
          <h4 className="text-sm font-semibold text-white">Enable Developer Mode</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Extract the zip file. Open Google Chrome, head to <code className="text-amber-400 text-[10px] bg-slate-900 px-1 py-0.5 rounded font-mono">chrome://extensions/</code>, and toggle on <strong className="text-slate-300">"Developer Mode"</strong> in the top right.
          </p>
        </div>

        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 flex flex-col gap-2">
          <div className="h-6 w-6 bg-indigo-950 text-indigo-400 rounded-full flex items-center justify-center font-bold text-xs">
            3
          </div>
          <h4 className="text-sm font-semibold text-white">Load Unpacked Folder</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Click the <strong className="text-indigo-400">"Load unpacked"</strong> button in the top left, select your extracted folder, and watch the extension sync with your active browser sessions!
          </p>
        </div>

      </div>

      {/* Architectural deep dive */}
      <div className="border-t border-slate-800 pt-6 flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <Code className="h-4 w-4 text-emerald-400" />
          Extension Architecture Deep-Dive
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Item 1 */}
          <div className="bg-slate-950/30 p-4 rounded-xl border border-slate-850/60 flex items-start gap-3">
            <Cpu className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-200">MutationObserver Subtitle Extraction</h4>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">
                Rather than constant polling, the extension hooks a lightweight DOM <code className="text-slate-300 text-[10px]">MutationObserver</code> directly to target video caption windows. Subtitle extracts happen instantaneously (&lt;10ms) whenever caption elements change.
              </p>
            </div>
          </div>

          {/* Item 2 */}
          <div className="bg-slate-950/30 p-4 rounded-xl border border-slate-850/60 flex items-start gap-3">
            <Shield className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-200">Shadow-DOM Styling Isolation</h4>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">
                To guarantee that CSS rules from major video host players (like Netflix or YouTube) never bleed into and mess up the custom overlay layouts, subtitles are rendered in an isolated, secure Shadow Root element.
              </p>
            </div>
          </div>

          {/* Item 3 */}
          <div className="bg-slate-950/30 p-4 rounded-xl border border-slate-850/60 flex items-start gap-3">
            <RefreshCw className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-200">Sliding Context History Memory</h4>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">
                To ensure pronoun correctness and situational accuracy, the client-side bridge maintains a sliding history buffer of the previous 3 caption nodes, forwarding this context directly as a payload to our Gemini AI endpoints.
              </p>
            </div>
          </div>

          {/* Item 4 */}
          <div className="bg-slate-950/30 p-4 rounded-xl border border-slate-850/60 flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-200">Manifest V3 Background Caching</h4>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">
                Bypasses standard client-side browser CORS restrictions safely. The service worker hosts a cache repository that checks translation history before calling downstream server endpoints, minimizing API costs.
              </p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
