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
