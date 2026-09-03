import type { ServiceTemplate, ChecklistItem, BenchmarkTable } from "@/lib/types";

// ========== Storage Keys ==========
export const STORAGE_KEYS = {
  subscriptions: "subtrack.subscriptions.v1",
  checklists: "subtrack.checklists.v1",
  settings: "subtrack.settings.v1",
  meta: "subtrack.meta.v1",
} as const;

// ========== Service Templates (12종) ==========
export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  { key: "netflix", name: "넷플릭스", category: "OTT", iconKey: "netflix" },
  { key: "tving", name: "TVING", category: "OTT", iconKey: "tving" },
  { key: "wavve", name: "Wavve", category: "OTT", iconKey: "wavve" },
  { key: "spotify", name: "Spotify", category: "MUSIC", iconKey: "spotify" },
  { key: "melon", name: "멜론", category: "MUSIC", iconKey: "melon" },
  { key: "genie", name: "지니", category: "MUSIC", iconKey: "genie" },
  { key: "ncloud", name: "네이버 클라우드", category: "CLOUD", iconKey: "ncloud" },
  { key: "gdrive", name: "Google Drive", category: "CLOUD", iconKey: "gdrive" },
  { key: "playstation", name: "PlayStation Plus", category: "GAME", iconKey: "playstation" },
  { key: "xbox", name: "Xbox Game Pass", category: "GAME", iconKey: "xbox" },
  { key: "notion", name: "Notion", category: "PRODUCTIVITY", iconKey: "notion" },
  { key: "slack", name: "Slack", category: "PRODUCTIVITY", iconKey: "slack" },
];

// ========== Default Checklist (5개) ==========
export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: "remaining", label: "미납금 확인", done: false, doneAt: null },
  { id: "autopay", label: "자동결제 해제", done: false, doneAt: null },
  { id: "backup", label: "데이터 백업", done: false, doneAt: null },
  { id: "notify", label: "알림 구독 해제", done: false, doneAt: null },
  { id: "capture", label: "로그인 정보 저장", done: false, doneAt: null },
];

// ========== Benchmark (연령별 평균) ==========
export const DEFAULT_BENCHMARK: BenchmarkTable = {
  "20-24": 45000,
  "25-29": 58000,
  "30-34": 72000,
  "35-39": 85000,
};

export function getBenchmark(jsonString?: string): BenchmarkTable {
  const json = jsonString ?? (import.meta.env.VITE_BENCHMARK_JSON as string | undefined);

  if (!json) {
    return DEFAULT_BENCHMARK;
  }

  try {
    return JSON.parse(json);
  } catch (e) {
    console.warn("Failed to parse VITE_BENCHMARK_JSON benchmark data, using defaults");
    return DEFAULT_BENCHMARK;
  }
}

// ========== Benchmark Disclaimer ==========
export const BENCHMARK_DISCLAIMER =
  "이 조사는 SubTrack 사용자 데이터를 기반으로 하며, 실제 시장 평균과 다를 수 있습니다.";

// ========== Numeric Constants ==========
export const MAX_SUBSCRIPTIONS = 100;
export const FREE_SUBSCRIPTION_LIMIT = 3;
export const MAX_PRICE_HISTORY = 20;
export const COMPARE_UNLOCK_HOURS = 24;
export const MAX_STORAGE_CHARS = 1048576; // 1MB
