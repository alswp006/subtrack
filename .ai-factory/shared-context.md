# Shared Context (auto-generated — do NOT modify)


## 패킷 간 계약 (src/lib/contract.ts — 자동 생성, 수정 금지)
여기 선언된 이름·인자·반환 타입은 확정이다. 기반 패킷은 이대로 구현하고,
화면 패킷은 이대로 호출하라. 다르게 만들지 마라.

```typescript
/**
 * 패킷 간 인터페이스 계약 — 자동 생성. **수정하지 마라.**
 *
 * 기반 패킷은 여기 선언된 모양 그대로 구현하고, 화면 패킷은 여기 적힌 이름·인자·반환
 * 타입을 그대로 가정해도 된다. 추측이 어긋나 병합에서 무너지는 것을 막기 위한 파일이다.
 */

/** 도메인 엔티티 — 모든 구독 관련 패킷에서 사용 (구현: 패킷 0001) */
export type Subscription = { id: string; name: string; amountKrw: number; billingCycle: 'monthly' | 'yearly' | 'weekly'; nextBillingDate: string; createdAt: string; cancelledAt?: string };

/** 설정 엔티티 — 0006, 0007, 0017, 0019에서 사용 (구현: 패킷 0001) */
export type Settings = { isPremium: boolean; premiumExpiresAt?: string; adCountFree: number; theme: 'light' | 'dark' | 'auto' };

/** 체크리스트 아이템 — 0006, 0014에서 사용 (구현: 패킷 0001) */
export type ChecklistItem = { id: string; task: string; completed: boolean; order: number };

/** 라우팅 상태 — 0018, 모든 페이지에서 사용 (구현: 패킷 0001) */
export type RouteState = { page: 'home' | 'subscriptions/new' | 'subscriptions/:id' | 'subscriptions/:id/edit' | 'subscriptions/:id/checklist' | 'compare' | 'more' | 'premium'; params?: Record<string, string> };

/** 원화 포맷팅 — 0009, 0010, 0012, 0015에서 사용 (구현: 패킷 0003) */
export type formatCurrencyKrwFn = (amount: number) => string;

/** 날짜 포맷팅 (구현: 패킷 0003) */
export type formatDateFn = (date: string, format?: 'short' | 'long') => string;

/** 다음 청구일까지 남은 일수 계산 (구현: 패킷 0003) */
export type getDaysUntilBillingFn = (nextBillingDate: string) => number;

/** 연간 예상 비용 계산 — 0009, 0015에서 사용 (구현: 패킷 0003) */
export type estimateAnnualCostFn = (subscriptions: Subscription[]) => number;

/** 안전한 스토리지 읽기 (구현: 패킷 0004) */
export type safeGetItemFn = <T>(key: string) => T | null;

/** 안전한 스토리지 쓰기 (구현: 패킷 0004) */
export type safeSetItemFn = <T>(key: string, value: T) => boolean;

/** 모든 구독 조회 — 0007, 0009, 0010, 0015에서 사용 (구현: 패킷 0005) */
export type getSubscriptionsFn = () => Promise<Subscription[]>;

/** 구독 생성 — 0011에서 사용 (구현: 패킷 0005) */
export type createSubscriptionFn = (data: Omit<Subscription, 'id' | 'createdAt'>) => Promise<Subscription>;

/** 구독 수정 — 0013에서 사용 (구현: 패킷 0005) */
export type updateSubscriptionFn = (id: string, data: Partial<Subscription>) => Promise<Subscription>;

/** 구독 삭제 — 0012, 0013에서 사용 (구현: 패킷 0005) */
export type deleteSubscriptionFn = (id: string) => Promise<void>;

/** 설정 조회 — 0007, 0017에서 사용 (구현: 패킷 0006) */
export type getSettingsFn = () => Promise<Settings>;

/** 설정 업데이트 — 0017에서 사용 (구현: 패킷 0006) */
export type updateSettingsFn = (data: Partial<Settings>) => Promise<Settings>;

/** 체크리스트 조회 — 0014에서 사용 (구현: 패킷 0006) */
export type getChecklistFn = (subscriptionId: string) => Promise<ChecklistItem[]>;

/** 체크리스트 업데이트 — 0014에서 사용 (구현: 패킷 0006) */
export type updateChecklistFn = (subscriptionId: string, items: ChecklistItem[]) => Promise<void>;

```

## Shared Types Contract (IMPORT these, do NOT redefine)
```typescript
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

```

## Existing Codebase (import and use these — do NOT recreate)
### File Tree (src/)
  App.tsx
  components/
    AdSlot.tsx
    Amount.tsx
    BottomCTA.tsx
    Card.tsx
    CountUp.tsx
    FloatingTabBar.tsx
    MiniBar.tsx
    PageShell.tsx
    ScreenScaffold.tsx
    Sparkline.tsx
    StateView.tsx
    SummaryHero.tsx
    TossPurchase.tsx
    TossRewardAd.tsx
  hooks/
  lib/
    contract.ts
    storage.ts
    types.ts
    utils.ts
  main.tsx
  pages/
    Home.tsx
    __TdsGallery.tsx
  styles/
    globals.css
    reward-ad.css
  types/
  vite-env.d.ts

### Exports (src/lib/)
- contract.ts: export type Subscription =; export type Settings =; export type ChecklistItem =; export type RouteState =; export type formatCurrencyKrwFn = (amount: number) => string; export type formatDateFn = (date: string, format?: 'short' | 'long') => string; export type getDaysUntilBillingFn = (nextBillingDate: string) => number; export type estimateAnnualCostFn = (subscriptions: Subscription[]) => number
- storage.ts: export function getItem<T>(key: string): T | null; export function setItem<T>(key: string, value: T): void; export function removeItem(key: string): void
- types.ts: export type BillingCycle = 'MONTHLY' | 'YEARLY'; export type SubscriptionStatus = 'ACTIVE' | 'CANCELED'; export type CategoryKey = | 'OTT' | 'MUSIC' | 'CLOUD' | 'GAME' | 'PRODUCTIVITY' | 'FITNESS' | 'ETC'; export type AgeBand = '20-24' | '25-29' | '30-34' | '35-39' | 'UNSET'; export interface PriceChange; export interface Subscription; export interface ChecklistItem; export interface CancelChecklist
- utils.ts: export function cn(...classes: (string | boolean | undefined | null)[]): string; export function formatNumber(n: number): string; export function formatCurrency(n: number, currency = 'KRW'): string

### Components (src/components/)
- AdSlot.tsx: AdSlot
- Amount.tsx: Amount
- BottomCTA.tsx: SubmitFooter, ButtonStack
- Card.tsx: Card
- CountUp.tsx: CountUp
- FloatingTabBar.tsx: FloatingTabBar
- MiniBar.tsx: MiniBar
- PageShell.tsx: PageShell
- ScreenScaffold.tsx: ScreenScaffold
- Sparkline.tsx: Sparkline
- StateView.tsx: EmptyState, LoadingState
- SummaryHero.tsx: SummaryHero
- TossPurchase.tsx: TossPurchase
- TossRewardAd.tsx: TossRewardAd
CRITICAL: Before creating any new function, type, or component, check the list above. If something similar exists, import and use it.

## Already Implemented (do NOT duplicate or overwrite)
- 0001: 도메인 타입 + RouteState 정의 (files: src/lib/types.ts)