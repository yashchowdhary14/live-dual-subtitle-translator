export interface SubtitleStyle {
  font: string;
  fontSize: number; // in px
  fontWeight: string; // 'normal', 'medium', 'bold'
  textColor: string; // hex color
  bgColor: string; // hex color
  bgOpacity: number; // 0 to 100
  position: "top" | "middle" | "bottom" | "above-original";
  offsetY: number; // vertical offset adjustment
  width: number; // width percentage (e.g., 80)
  borderRadius: number; // in px
  lineSpacing: number; // em
  translationOpacity: number; // 0 to 100
  shadowEnabled: boolean;
}

export type ApiProvider = "gemini" | "google" | "libre" | "deepl";

export interface ExtensionConfig {
  isEnabled: boolean;
  sourceLang: string;
  targetLang: string;
  showOriginal: boolean;
  translateOnly: boolean;
  autoDetect: boolean;
  lowLatencyMode: boolean;
  apiProvider: ApiProvider;
  apiKey: string;
  style: SubtitleStyle;
}

export interface MockSubtitle {
  id: string;
  start: number; // in seconds
  end: number; // in seconds
  text: string; // original text
}

export interface HistoryItem {
  id: string;
  timestamp: string;
  videoTitle: string;
  original: string;
  translated: string;
  sourceLang: string;
  targetLang: string;
}

export interface FileItem {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: string[];
  content?: string;
}
