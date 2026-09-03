// 구독 목록 상태 훅 — 첫 렌더는 반드시 'loading'을 반환해 빈 상태 깜빡임을 막고,
// 마운트 후 마이크로태스크에서 스토리지를 읽어 'ready'로 전환한다.

import { useCallback, useEffect, useState } from 'react';
import type { Subscription } from '@/lib/types';
import { readJson, writeJson } from '@/domain/storage';
import { STORAGE_KEYS } from '@/lib/constants';
import { monthlyAmount } from '@/domain/calc';

export type UseSubscriptionsStatus = 'loading' | 'ready' | 'error';

export interface UseSubscriptionsReturn {
  status: UseSubscriptionsStatus;
  items: Subscription[];
  totalMonthly: number;
  activeCount: number;
  canceledCount: number;
  upcoming: Subscription[];
  reload: () => void;
  remove: (id: string) => Promise<void>;
}

function normalizeSubscription(value: unknown): Subscription | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || typeof v.name !== 'string' || typeof v.amount !== 'number') {
    return null;
  }
  return {
    id: v.id,
    name: v.name,
    category: typeof v.category === 'string' ? (v.category as Subscription['category']) : 'ETC',
    iconKey: typeof v.iconKey === 'string' ? v.iconKey : 'generic',
    amount: v.amount,
    cycle: v.cycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY',
    firstBillingDate: typeof v.firstBillingDate === 'string' ? v.firstBillingDate : '',
    nextBillingDate: typeof v.nextBillingDate === 'string' ? v.nextBillingDate : '',
    memo: typeof v.memo === 'string' ? v.memo : '',
    status: v.status === 'CANCELED' ? 'CANCELED' : 'ACTIVE',
    priceHistory: Array.isArray(v.priceHistory) ? (v.priceHistory as Subscription['priceHistory']) : [],
    createdAt: typeof v.createdAt === 'string' ? v.createdAt : '',
    updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : '',
  };
}

function loadSubscriptions(): Subscription[] {
  const raw = readJson<unknown[]>(STORAGE_KEYS.subscriptions, []);
  if (!Array.isArray(raw)) return [];
  const result: Subscription[] = [];
  for (const item of raw) {
    const normalized = normalizeSubscription(item);
    if (normalized) result.push(normalized);
  }
  return result;
}

function saveSubscriptions(items: Subscription[]): void {
  writeJson(STORAGE_KEYS.subscriptions, items);
}

function sortByNextBillingDate(items: Subscription[]): Subscription[] {
  return [...items].sort((a, b) => {
    const aEmpty = a.nextBillingDate === '';
    const bEmpty = b.nextBillingDate === '';
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    if (a.nextBillingDate < b.nextBillingDate) return -1;
    if (a.nextBillingDate > b.nextBillingDate) return 1;
    return 0;
  });
}

export function useSubscriptions(): UseSubscriptionsReturn {
  const [status, setStatus] = useState<UseSubscriptionsStatus>('loading');
  const [items, setItems] = useState<Subscription[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        setItems(loadSubscriptions());
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const reload = useCallback(() => {
    setStatus('loading');
    setVersion((v) => v + 1);
  }, []);

  const remove = useCallback(async (id: string) => {
    const current = loadSubscriptions();
    const next = current.filter((item) => item.id !== id);
    saveSubscriptions(next);
    setItems(next);
  }, []);

  let totalMonthly = 0;
  let activeCount = 0;
  let canceledCount = 0;
  for (const item of items) {
    if (item.status === 'ACTIVE') {
      activeCount += 1;
      totalMonthly += monthlyAmount({ amount: item.amount, cycle: item.cycle });
    } else {
      canceledCount += 1;
    }
  }

  const upcoming = sortByNextBillingDate(items.filter((item) => item.status === 'ACTIVE'));

  return { status, items, totalMonthly, activeCount, canceledCount, upcoming, reload, remove };
}
