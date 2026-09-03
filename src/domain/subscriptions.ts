// 구독 CRUD · 검증 · 가격 이력 — 화면은 localStorage에 직접 접근하지 않고 이 모듈만 사용한다.
//
// NOTE: 이 모듈의 레코드/결과 타입은 이 패킷의 테스트 계약(priceHistory가 oldAmount/newAmount
// 필드를 가지며, 에러가 중첩 객체가 아닌 평탄한 문자열)을 따른다 — src/lib/types.ts의
// Subscription/PriceChange/Result<T>와 필드 형태가 다르다(그쪽은 이미 packet-0001 테스트로
// 고정됨). 두 계약이 상충해 이 파일에서는 로컬 타입을 쓴다.

import type { StorageErrorCode, Subscription, PriceChange } from '@/lib/types';
import { readJson, writeJson, newId } from '@/domain/storage';
import { STORAGE_KEYS, MAX_SUBSCRIPTIONS, MAX_PRICE_HISTORY } from '@/lib/constants';
import { getToday, isValidDateString, computeNextBillingDate } from '@/domain/calc';

const NAME_MAX = 20;
const AMOUNT_MIN = 1;
const AMOUNT_MAX = 10_000_000;
const MEMO_MAX = 100;

export interface SubscriptionPriceChange {
  oldAmount: number;
  newAmount: number;
  changedAt: string;
}

export interface SubscriptionRecord {
  id: string;
  name: string;
  amount: number;
  firstBillingDate: string;
  nextBillingDate: string;
  memo: string;
  priceHistory: SubscriptionPriceChange[];
  createdAt: string;
}

export interface SubscriptionInput {
  name: string;
  amount: number;
  firstBillingDate: string;
  memo: string;
}

export type SubscriptionFieldName = 'name' | 'amount' | 'firstBillingDate' | 'memo';

export type SaveSubscriptionResult =
  | { ok: true; data: SubscriptionRecord }
  | { ok: false; error: StorageErrorCode; fields?: SubscriptionFieldName[] };

export type UpdateSubscriptionResult =
  | { ok: true; data: SubscriptionRecord; delta: number }
  | { ok: false; error: StorageErrorCode; fields?: SubscriptionFieldName[] };

function normalizeRecord(value: unknown): SubscriptionRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || typeof v.name !== 'string' || typeof v.amount !== 'number') {
    return null;
  }
  return {
    id: v.id,
    name: v.name,
    amount: v.amount,
    firstBillingDate: typeof v.firstBillingDate === 'string' ? v.firstBillingDate : '',
    nextBillingDate: typeof v.nextBillingDate === 'string' ? v.nextBillingDate : '',
    memo: typeof v.memo === 'string' ? v.memo : '',
    priceHistory: Array.isArray(v.priceHistory) ? (v.priceHistory as SubscriptionPriceChange[]) : [],
    createdAt: typeof v.createdAt === 'string' ? v.createdAt : '',
  };
}

/** 저장된 모든 구독 조회 — 손상/부분 데이터는 정규화해 안전한 기본값으로 채운다. */
export function listSubscriptions(): SubscriptionRecord[] {
  const raw = readJson<unknown[]>(STORAGE_KEYS.subscriptions, []);
  if (!Array.isArray(raw)) return [];
  const result: SubscriptionRecord[] = [];
  for (const item of raw) {
    const normalized = normalizeRecord(item);
    if (normalized) result.push(normalized);
  }
  return result;
}

/** name(trim 1~20자) · amount(정수 1~10,000,000) · firstBillingDate(유효+오늘 이후) · memo(100자 이하) 검증. */
export function validateSubscriptionInput(input: SubscriptionInput): SubscriptionFieldName[] {
  const errors: SubscriptionFieldName[] = [];

  const trimmedName = typeof input.name === 'string' ? input.name.trim() : '';
  if (trimmedName.length < 1 || trimmedName.length > NAME_MAX) errors.push('name');

  if (
    typeof input.amount !== 'number' ||
    !Number.isInteger(input.amount) ||
    input.amount < AMOUNT_MIN ||
    input.amount > AMOUNT_MAX
  ) {
    errors.push('amount');
  }

  if (
    typeof input.firstBillingDate !== 'string' ||
    !isValidDateString(input.firstBillingDate) ||
    input.firstBillingDate < getToday()
  ) {
    errors.push('firstBillingDate');
  }

  const memo = typeof input.memo === 'string' ? input.memo : '';
  if (memo.length > MEMO_MAX) errors.push('memo');

  return errors;
}

/** 신규 구독 저장 — id/nextBillingDate를 채우고 100건 상한을 넘으면 MAX_ITEMS로 거절한다. */
export function saveSubscription(input: SubscriptionInput): SaveSubscriptionResult {
  const errors = validateSubscriptionInput(input);
  if (errors.length > 0) {
    return { ok: false, error: 'VALIDATION', fields: errors };
  }

  const list = listSubscriptions();
  if (list.length >= MAX_SUBSCRIPTIONS) {
    return { ok: false, error: 'MAX_ITEMS' };
  }

  const record: SubscriptionRecord = {
    id: newId(),
    name: input.name.trim(),
    amount: input.amount,
    firstBillingDate: input.firstBillingDate,
    nextBillingDate: computeNextBillingDate(input.firstBillingDate, 'MONTHLY'),
    memo: typeof input.memo === 'string' ? input.memo : '',
    priceHistory: [],
    createdAt: new Date().toISOString(),
  };

  const written = writeJson(STORAGE_KEYS.subscriptions, [...list, record]);
  if (!written.ok) {
    return { ok: false, error: 'STORAGE_FULL' };
  }

  return { ok: true, data: record };
}

/** 구독 수정 — amount가 실제로 바뀔 때만 priceHistory에 push하고(20건 초과 시 가장 오래된 항목 제거), delta를 반환한다. */
export function updateSubscription(
  id: string,
  patch: Partial<SubscriptionInput>,
): UpdateSubscriptionResult {
  const list = listSubscriptions();
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) {
    return { ok: false, error: 'NOT_FOUND' };
  }

  const current = list[idx];
  const merged: SubscriptionInput = {
    name: patch.name !== undefined ? patch.name : current.name,
    amount: patch.amount !== undefined ? patch.amount : current.amount,
    firstBillingDate:
      patch.firstBillingDate !== undefined ? patch.firstBillingDate : current.firstBillingDate,
    memo: patch.memo !== undefined ? patch.memo : current.memo,
  };

  const errors = validateSubscriptionInput(merged);
  if (errors.length > 0) {
    return { ok: false, error: 'VALIDATION', fields: errors };
  }

  const amountChanged = patch.amount !== undefined && patch.amount !== current.amount;
  const delta = amountChanged ? merged.amount - current.amount : 0;

  const priceHistory = current.priceHistory.slice();
  if (amountChanged) {
    priceHistory.push({
      oldAmount: current.amount,
      newAmount: merged.amount,
      changedAt: new Date().toISOString(),
    });
    if (priceHistory.length > MAX_PRICE_HISTORY) {
      priceHistory.shift();
    }
  }

  const updated: SubscriptionRecord = {
    ...current,
    name: merged.name.trim(),
    amount: merged.amount,
    firstBillingDate: merged.firstBillingDate,
    nextBillingDate: computeNextBillingDate(merged.firstBillingDate, 'MONTHLY'),
    memo: merged.memo,
    priceHistory,
  };

  const nextList = list.slice();
  nextList[idx] = updated;

  const written = writeJson(STORAGE_KEYS.subscriptions, nextList);
  if (!written.ok) {
    return { ok: false, error: 'STORAGE_FULL' };
  }

  return { ok: true, data: updated, delta };
}

/** 구독 삭제 — 존재하지 않는 id도 예외 없이 무시한다. */
export function deleteSubscription(id: string): void {
  const list = listSubscriptions();
  const next = list.filter((s) => s.id !== id);
  writeJson(STORAGE_KEYS.subscriptions, next);
}

// ── src/lib/contract.ts 호환 래퍼 ──────────────────────────────────────────
// contract.ts는 이 패킷이 getSubscriptions/createSubscription을 export한다고 가정한다.
// 다만 contract.ts의 인라인 Subscription 타입(amountKrw/billingCycle)은 spec.md Data
// Models(및 packet-0001 테스트로 고정된 src/lib/types.ts의 Subscription)와 어긋난
// 구버전 초안이다 — spec.md가 우선하므로, 아래는 이름/비동기 시그니처만 계약을 지키고
// 실제 도메인 타입은 @/lib/types의 Subscription을 따른다. 내부 저장 포맷(SubscriptionRecord)
// 은 category/cycle/status를 갖지 않으므로 이 앱의 MVP 범위(월간 구독)에 맞는 기본값을 채운다.
function toSubscription(record: SubscriptionRecord): Subscription {
  const priceHistory: PriceChange[] = record.priceHistory.map((change, index) => ({
    id: `${record.id}-ph-${index}`,
    amount: change.newAmount,
    changedAt: change.changedAt,
    note: '',
  }));
  return {
    id: record.id,
    name: record.name,
    category: 'ETC',
    iconKey: 'custom',
    amount: record.amount,
    cycle: 'MONTHLY',
    firstBillingDate: record.firstBillingDate,
    nextBillingDate: record.nextBillingDate,
    memo: record.memo,
    status: 'ACTIVE',
    priceHistory,
    createdAt: record.createdAt,
    updatedAt: record.createdAt,
  };
}

/** 모든 구독 조회 (contract: getSubscriptionsFn) — listSubscriptions의 비동기 래퍼. */
export async function getSubscriptions(): Promise<Subscription[]> {
  return listSubscriptions().map(toSubscription);
}

/** 구독 생성 (contract: createSubscriptionFn) — saveSubscription의 비동기 래퍼.
 * 검증 실패·100건 한도 초과 시 reject한다(saveSubscription의 Result는 화면단에서
 * 인라인 에러로 다뤄야 하므로, 필드별 에러가 필요하면 saveSubscription을 직접 쓰라). */
export async function createSubscription(
  data: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Subscription> {
  const result = saveSubscription({
    name: data.name,
    amount: data.amount,
    firstBillingDate: data.firstBillingDate,
    memo: data.memo,
  });
  if (!result.ok) {
    throw new Error(result.error);
  }
  return toSubscription(result.data);
}
