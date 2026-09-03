// SubTrack 도메인 타입 + 라우트 state 계약. 순수 타입 선언만 — import/런타임 코드 없음.

export type BillingCycle = 'MONTHLY' | 'YEARLY';

export type SubscriptionStatus = 'ACTIVE' | 'CANCELED';

export type CategoryKey =
  | 'OTT'
  | 'MUSIC'
  | 'CLOUD'
  | 'GAME'
  | 'PRODUCTIVITY'
  | 'FITNESS'
  | 'ETC';

export type AgeBand = '20-24' | '25-29' | '30-34' | '35-39' | 'UNSET';

export interface PriceChange {
  id: string;
  amount: number;
  changedAt: string;
  note: string;
}

export interface Subscription {
  id: string;
  name: string;
  category: CategoryKey;
  iconKey: string;
  amount: number;
  cycle: BillingCycle;
  firstBillingDate: string;
  nextBillingDate: string;
  memo: string;
  status: SubscriptionStatus;
  priceHistory: PriceChange[];
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  doneAt: string | null;
}

export interface CancelChecklist {
  subscriptionId: string;
  items: ChecklistItem[];
  updatedAt: string;
}

export interface AppSettings {
  ageBand: AgeBand;
  isPremium: boolean;
  premiumGrantedAt: string | null;
  compareUnlockedAt: string | null;
  onboardedAt: string | null;
}

export interface StorageMeta {
  schemaVersion: 1;
  migratedAt: string;
}

export interface ServiceTemplate {
  key: string;
  name: string;
  category: CategoryKey;
  iconKey: string;
}

export type BenchmarkTable = Record<Exclude<AgeBand, 'UNSET'>, number>;

export type StorageErrorCode =
  | 'STORAGE_FULL'
  | 'VALIDATION'
  | 'MAX_ITEMS'
  | 'NOT_FOUND'
  | 'UNKNOWN';

export interface StorageError {
  code: StorageErrorCode;
  fields: string[] | null;
}

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: StorageError };

export type LoadState<T> =
  | { status: 'idle'; data: null }
  | { status: 'loading'; data: null }
  | { status: 'ready'; data: T }
  | { status: 'error'; data: null; error: string };

export interface RouteState {
  '/': { toastMessage: string } | null;
  '/subscriptions/new': { templateKey: string } | null;
  '/subscriptions/:id': { subscriptionId: string } | null;
  '/subscriptions/:id/edit': { subscriptionId: string } | null;
  '/subscriptions/:id/checklist': { subscriptionId: string; from: string } | null;
  '/compare': { source: string } | null;
  '/more': { source: string } | null;
  '/premium': { source: string } | null;
}
