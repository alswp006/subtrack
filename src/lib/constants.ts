// 정적 상수 · 스토리지 키 정의. 도메인 타입은 types.ts에서 import한다.

import type { ServiceTemplate, ChecklistItem, BenchmarkTable } from '@/lib/types';

export const STORAGE_KEYS = {
  subscriptions: 'subtrack.subscriptions.v1',
  checklists: 'subtrack.checklists.v1',
  settings: 'subtrack.settings.v1',
  meta: 'subtrack.meta.v1',
} as const;

export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  { key: 'netflix', name: '넷플릭스', category: 'OTT', iconKey: 'netflix' },
  { key: 'youtube-premium', name: '유튜브 프리미엄', category: 'OTT', iconKey: 'youtube' },
  { key: 'disney-plus', name: '디즈니플러스', category: 'OTT', iconKey: 'disney' },
  { key: 'watcha', name: '왓챠', category: 'OTT', iconKey: 'watcha' },
  { key: 'melon', name: '멜론', category: 'MUSIC', iconKey: 'melon' },
  { key: 'spotify', name: '스포티파이', category: 'MUSIC', iconKey: 'spotify' },
  { key: 'genie', name: '지니뮤직', category: 'MUSIC', iconKey: 'genie' },
  { key: 'icloud', name: '아이클라우드', category: 'CLOUD', iconKey: 'icloud' },
  { key: 'google-one', name: '구글 원', category: 'CLOUD', iconKey: 'google-one' },
  { key: 'notion', name: '노션', category: 'PRODUCTIVITY', iconKey: 'notion' },
  { key: 'chatgpt-plus', name: '챗지피티 플러스', category: 'PRODUCTIVITY', iconKey: 'chatgpt' },
  { key: 'coupang-play', name: '쿠팡플레이', category: 'OTT', iconKey: 'coupang-play' },
];

export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: 'remaining', label: '남은 이용 기간을 확인했어요', done: false, doneAt: null },
  { id: 'autopay', label: '자동결제 해지를 신청했어요', done: false, doneAt: null },
  { id: 'backup', label: '데이터를 백업해 뒀어요', done: false, doneAt: null },
  { id: 'notify', label: '같이 쓰는 사람에게 알렸어요', done: false, doneAt: null },
  { id: 'capture', label: '해지 화면을 캡처해 뒀어요', done: false, doneAt: null },
];

export const DEFAULT_BENCHMARK: BenchmarkTable = {
  '20-24': 18000,
  '25-29': 24000,
  '30-34': 29000,
  '35-39': 33000,
};

export const BENCHMARK_DISCLAIMER =
  '같은 연령대 평균은 참고용 추정치예요. 실제 이용 데이터와 다를 수 있어요.';

export const MAX_SUBSCRIPTIONS = 100;
export const FREE_SUBSCRIPTION_LIMIT = 3;
export const MAX_PRICE_HISTORY = 20;
export const COMPARE_UNLOCK_HOURS = 24;
export const MAX_STORAGE_CHARS = 1048576;

function isValidBenchmarkTable(value: unknown): value is BenchmarkTable {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (['20-24', '25-29', '30-34', '35-39'] as const).every(
    (band) => typeof record[band] === 'number',
  );
}

export function getBenchmark(
  raw: string = (import.meta.env.VITE_BENCHMARK_JSON as string | undefined) ?? '',
): BenchmarkTable {
  if (!raw) return DEFAULT_BENCHMARK;
  try {
    const parsed = JSON.parse(raw);
    if (!isValidBenchmarkTable(parsed)) {
      console.warn('getBenchmark: invalid benchmark json shape, falling back to default');
      return DEFAULT_BENCHMARK;
    }
    return parsed;
  } catch {
    console.warn('getBenchmark: failed to parse benchmark json, falling back to default');
    return DEFAULT_BENCHMARK;
  }
}
