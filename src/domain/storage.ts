// 스토리지 저수준 프리미티브 — localStorage 안전 읽기/쓰기. 엔티티 로직은 여기 넣지 않는다.

import type { StorageMeta } from '@/lib/types';
import { STORAGE_KEYS, MAX_STORAGE_CHARS } from '@/lib/constants';

const SUBTRACK_PREFIX = 'subtrack.';

export type WriteResult = { ok: boolean; error?: 'STORAGE_FULL' };

export function readJson<T>(key: string, fallback: T): T {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return fallback;
  }
  if (raw === null) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    try {
      localStorage.setItem(`${key}.corrupt`, raw);
      localStorage.removeItem(key);
    } catch {
      // best-effort — quota issues here shouldn't crash the caller
    }
    console.warn(`readJson: "${key}"의 JSON이 손상돼 "${key}.corrupt"로 이동했어요`);
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T): WriteResult {
  let json: string;
  try {
    json = JSON.stringify(value);
  } catch {
    return { ok: false, error: 'STORAGE_FULL' };
  }
  if (json.length > MAX_STORAGE_CHARS) {
    return { ok: false, error: 'STORAGE_FULL' };
  }

  try {
    localStorage.setItem(key, json);
    return { ok: true };
  } catch {
    return { ok: false, error: 'STORAGE_FULL' };
  }
}

export function safeGetItem<T>(key: string): T | null {
  return readJson<T | null>(key, null);
}

export function safeSetItem<T>(key: string, value: T): boolean {
  return writeJson(key, value).ok;
}

export function ensureMeta(): StorageMeta {
  const existing = readJson<StorageMeta | null>(STORAGE_KEYS.meta, null);
  if (existing) return existing;

  const meta: StorageMeta = { schemaVersion: 1, migratedAt: new Date().toISOString() };
  writeJson(STORAGE_KEYS.meta, meta);
  return meta;
}

export function clearAll(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(SUBTRACK_PREFIX)) keys.push(key);
    }
    for (const key of keys) {
      try {
        localStorage.removeItem(key);
      } catch {
        // best-effort — continue clearing remaining keys
      }
    }
  } catch {
    // localStorage unavailable — nothing to clear
  }
}

export function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to hex fallback
  }

  let id = '';
  for (let i = 0; i < 32; i++) {
    id += Math.floor(Math.random() * 16).toString(16);
  }
  return id;
}
