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

## Available exports from existing files
// src/App.tsx
export default function App() {

// src/components/AdSlot.tsx
export function AdSlot({ adGroupId, className, variant, theme }: AdSlotProps) {

// src/components/Amount.tsx
export function Amount({

// src/components/BottomCTA.tsx
export function SubmitFooter({
export function ButtonStack({

// src/components/Card.tsx
export function Card({

// src/components/CountUp.tsx
export function CountUp({

// src/components/FloatingTabBar.tsx
export type TabItem = {
export function FloatingTabBar({ items }: { items: TabItem[] }) {

// src/components/MiniBar.tsx
export function MiniBar({

// src/components/PageShell.tsx
export function PageShell({ children, style }: { children: ReactNode; style?: CSSProperties }) {

// src/components/ScreenScaffold.tsx
export function ScreenScaffold({

// src/components/Sparkline.tsx
export function Sparkline({

// src/components/StateView.tsx
export function EmptyState({
export function LoadingState({

// src/components/SummaryHero.tsx
export function SummaryHero({

// src/components/TossPurchase.tsx
export interface TossPurchaseResult {
export function TossPurchase({

// src/components/TossRewardAd.tsx
export function TossRewardAd({

// src/lib/contract.ts
export type Subscription = { id: string; name: string; amountKrw: number; billingCycle: 'monthly' | 'yearly' | 'weekly'; nextBillingDate: string; createdAt: string; cancelledAt?: string };
export type Settings = { isPremium: boolean; premiumExpiresAt?: string; adCountFree: number; theme: 'light' | 'dark' | 'auto' };
export type ChecklistItem = { id: string; task: string; completed: boolean; order: number };
export type RouteState = { page: 'home' | 'subscriptions/new' | 'subscriptions/:id' | 'subscriptions/:id/edit' | 'subscriptions/:id/checklist' | 'compare' | 'more' | 'premium'; params?: Record<string, string> };
export type formatCurrencyKrwFn = (amount: number) => string;
export type formatDateFn = (date: string, format?: 'short' | 'long') => string;
export type getDaysU

## Memory Index (자동 학습 — 힌트로만 사용, 실제 코드 확인 필수)

Available topics: deploy(2), general(10), testing(1), ui(1)

Key lessons (verify against actual code before applying):
- [deploy] 앱 부팅에 필수적인 배선(루트 컴포넌트·라우터·전역 Provider·인증 가드)은 개별 화면보다 먼저 스켈레톤으로 구현해 파이프라인 초반에 머지하고, 화면 패킷은 그 위에 라우트를 채워 넣는 방식으로 진행하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 저장·데이터 접근 등 기반 계층 패킷은 이를 import 하는 화면 패킷보다 반드시 먼저 완료·병합하고, 미완료면 상위 화면 패킷 병합을 차단하라 — 빈 기반 모듈 하나가 전 라우트 스모크를 무너뜨린다. (60% · 타 앱 1회 — 맹신 금지)
- [general] 외부에서 들어온 모든 값(라우터 state, 로컬 저장소, 부분 입력 폼)은 사용 직전에 배열·객체 기본값으로 정규화하고, 테이블/맵 조회 결과는 존재 확인 후에만 하위 속성이나 length에 접근하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 의존 그래프 최하층의 타입·계약 파일은 런타임 코드 0줄의 순수 선언으로 가장 먼저 단독 타입체크를 통과시키고, 파일 생성은 셸 명령이 아닌 허용된 편집 도구로만 하게 강제하라. (60% · 타 앱 1회 — 맹신 금지)
- [general] 영속 저장소에서 읽은 값은 항상 스키마 기본값으로 정규화해 배열·객체 타입을 보장한 뒤 반환하고, 화면은 빈/손상/부분 데이터에서도 렌더되도록 방어하라. (60% · 타 앱 1회 — 맹신 금지)