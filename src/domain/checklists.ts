// 해지 체크리스트 리포지토리 — 구독별 DEFAULT_CHECKLIST 복사본 + 토글 상태.

import type { CancelChecklist, ChecklistItem } from '@/lib/types';
import { readJson, writeJson } from '@/domain/storage';
import { STORAGE_KEYS, DEFAULT_CHECKLIST } from '@/lib/constants';

type ChecklistStore = Record<string, CancelChecklist>;

function cloneItems(items: ChecklistItem[]): ChecklistItem[] {
  return items.map((item) => ({ ...item }));
}

function readAll(): ChecklistStore {
  return readJson<ChecklistStore>(STORAGE_KEYS.checklists, {});
}

function writeAll(all: ChecklistStore): void {
  writeJson(STORAGE_KEYS.checklists, all);
}

function createDefault(subscriptionId: string): CancelChecklist {
  return {
    subscriptionId,
    items: cloneItems(DEFAULT_CHECKLIST),
    updatedAt: new Date().toISOString(),
  };
}

export function getChecklist(subscriptionId: string): CancelChecklist {
  const all = readAll();
  let checklist = all[subscriptionId];

  if (!checklist) {
    checklist = createDefault(subscriptionId);
    all[subscriptionId] = checklist;
    writeAll(all);
  }

  return {
    subscriptionId: checklist.subscriptionId,
    items: cloneItems(checklist.items),
    updatedAt: checklist.updatedAt,
  };
}

export function toggleChecklistItem(subscriptionId: string, itemId: string): void {
  const all = readAll();
  const checklist = all[subscriptionId] ?? createDefault(subscriptionId);

  const items = checklist.items.map((item) => {
    if (item.id !== itemId) return item;
    const done = !item.done;
    return { ...item, done, doneAt: done ? new Date().toISOString() : null };
  });

  all[subscriptionId] = { ...checklist, items, updatedAt: new Date().toISOString() };
  writeAll(all);
}

export function getChecklistProgress(subscriptionId: string): { done: number; total: number } {
  const { items } = getChecklist(subscriptionId);
  return { done: items.filter((item) => item.done).length, total: items.length };
}

// ── src/lib/contract.ts 호환 래퍼 ──────────────────────────────────────────
// contract.ts는 이 패킷이 updateChecklist(subscriptionId, items)를 async로 export한다고
// 가정한다. 다만 contract.ts의 인라인 ChecklistItem 타입(task/completed/order)은 spec.md 및
// packet-0006 테스트로 고정된 @/lib/types의 ChecklistItem(label/done/doneAt)과 어긋난
// 구버전 초안이다(src/domain/subscriptions.ts의 동일 사례 참조) — 실제 도메인 타입을 따르고
// 이름·비동기 시그니처만 계약을 지킨다. 전달된 items로 전체 목록을 통째로 교체 저장한다
// (단일 항목 토글은 toggleChecklistItem을 쓴다).
export async function updateChecklist(subscriptionId: string, items: ChecklistItem[]): Promise<void> {
  const all = readAll();
  const existing = all[subscriptionId] ?? createDefault(subscriptionId);
  all[subscriptionId] = {
    ...existing,
    items: cloneItems(items),
    updatedAt: new Date().toISOString(),
  };
  writeAll(all);
}
