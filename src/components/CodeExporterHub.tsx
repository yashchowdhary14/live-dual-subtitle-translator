import React, { useState } from "react";
import { Folder, FileCode, Download, Copy, Check, Eye, Terminal, BookOpen } from "lucide-react";
import JSZip from "jszip";
import { extensionSources } from "../data/extensionSources";

export default function CodeExporterHub() {
  const [selectedFile, setSelectedFile] = useState<string>("manifest.json");
  const [copied, setCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  // Split extension sources into folder categorizations for file explorer UI
  const filesList = Object.keys(extensionSources).map((path) => {
    const parts = path.split("/");
    return {
      path,
      name: parts[parts.length - 1],
      folder: parts.length > 1 ? parts[0] : null,
    };
  });

  // Group files by folder
  const rootFiles = filesList.filter((f) => !f.folder);
  const contentFiles = filesList.filter((f) => f.folder === "content");
  const popupFiles = filesList.filter((f) => f.folder === "popup");
  const optionsFiles = filesList.filter((f) => f.folder === "options");

  const handleCopy = () => {
    navigator.clipboard.writeText(extensionSources[selectedFile]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();

      // Loop over our virtual file system files and add them to JSZip
      Object.entries(extensionSources).forEach(([filePath, content]) => {
        zip.file(filePath, content);
      });

      // Also let's auto-generate a custom README in the zip file
      zip.file("README.md", `# Dual Subtitle API Translator Extension
Manifest V3 Chrome extension that overlays real-time translated captions directly on top of video streams.

## Installation Guide
1. Download and extract this zip file to a directory.
2. Open Chrome and head to \`chrome://extensions/\`.
3. Toggle on **Developer Mode** in the top-right corner.
4. Click **Load Unpacked** in the top-left corner.
5. Select the extracted folder.
6. Open any YouTube or Netflix video and select your favorite translation engines.

Enjoy real-time bilingual overlays!
`);

      // Generate the raw blob
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = "live-dual-subtitle-translator.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("ZIP Generation failed:", err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col lg:flex-row min-h-[500px]">
      {/* Sidebar File Explorer */}
      <div className="w-full lg:w-64 bg-slate-950 border-b lg:border-b-0 lg:border-r border-slate-800 p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
            Extension Workspace
          </span>
          <button
            onClick={handleDownloadZip}
            disabled={isZipping}
            className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            {isZipping ? "Packing..." : "Get ZIP"}
          </button>
        </div>

        {/* Directory Listing Tree */}
        <div className="flex flex-col gap-3 overflow-y-auto text-sm select-none">
          
          {/* Root Directory Files */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-slate-500 font-mono font-bold flex items-center gap-1">
              <Folder className="h-3.5 w-3.5 text-slate-600" />
              /extension
            </span>
            <div className="pl-4 flex flex-col gap-1">
              {rootFiles.map((file) => (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file.path)}
                  className={`flex items-center gap-1.5 py-1 px-2 rounded text-left transition cursor-pointer ${
                    selectedFile === file.path
                      ? "bg-indigo-600/25 text-indigo-400 font-medium"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  }`}
                >
                  <FileCode className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-mono text-xs truncate">{file.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* content/ folder */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-slate-500 font-mono font-bold flex items-center gap-1">
              <Folder className="h-3.5 w-3.5 text-indigo-600/80" />
              content/
            </span>
            <div className="pl-4 flex flex-col gap-1 border-l border-slate-850 ml-1.5">
              {contentFiles.map((file) => (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file.path)}
                  className={`flex items-center gap-1.5 py-1 px-2 rounded text-left transition cursor-pointer ${
                    selectedFile === file.path
                      ? "bg-indigo-600/25 text-indigo-400 font-medium"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  }`}
                >
                  <FileCode className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="font-mono text-xs truncate">{file.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* popup/ folder */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-slate-500 font-mono font-bold flex items-center gap-1">
              <Folder className="h-3.5 w-3.5 text-amber-600/80" />
              popup/
            </span>
            <div className="pl-4 flex flex-col gap-1 border-l border-slate-850 ml-1.5">
              {popupFiles.map((file) => (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file.path)}
                  className={`flex items-center gap-1.5 py-1 px-2 rounded text-left transition cursor-pointer ${
                    selectedFile === file.path
                      ? "bg-indigo-600/25 text-indigo-400 font-medium"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  }`}
                >
                  <FileCode className="h-3.5 w-3.5 text-amber-400" />
                  <span className="font-mono text-xs truncate">{file.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* options/ folder */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-slate-500 font-mono font-bold flex items-center gap-1">
              <Folder className="h-3.5 w-3.5 text-emerald-600/80" />
              options/
            </span>
            <div className="pl-4 flex flex-col gap-1 border-l border-slate-850 ml-1.5">
              {optionsFiles.map((file) => (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file.path)}
                  className={`flex items-center gap-1.5 py-1 px-2 rounded text-left transition cursor-pointer ${
                    selectedFile === file.path
                      ? "bg-indigo-600/25 text-indigo-400 font-medium"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  }`}
                >
                  <FileCode className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="font-mono text-xs truncate">{file.name}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Code Viewer Panel */}
      <div className="flex-1 bg-slate-950 flex flex-col overflow-hidden">
        {/* Header toolbar */}
        <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-indigo-400" />
            <span className="font-mono text-xs text-slate-300 font-semibold">{selectedFile}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy Code
                </>
              )}
            </button>
          </div>
        </div>

        {/* Code Block Container */}
        <div className="p-4 overflow-auto flex-1 font-mono text-xs leading-relaxed max-h-[500px]">
          <pre className="text-slate-300 select-text outline-none whitespace-pre-wrap">
            <code>{extensionSources[selectedFile]}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
