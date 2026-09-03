// 설정 리포지토리 — 연령대·프리미엄·비교 잠금해제 상태.

import type { AppSettings } from '@/lib/types';
import { readJson, writeJson } from '@/domain/storage';
import { STORAGE_KEYS, COMPARE_UNLOCK_HOURS } from '@/lib/constants';

const DEFAULT_SETTINGS: AppSettings = {
  ageBand: 'UNSET',
  isPremium: false,
  premiumGrantedAt: null,
  compareUnlockedAt: null,
  onboardedAt: null,
};

export function getSettings(): AppSettings {
  return readJson<AppSettings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...patch };
  writeJson(STORAGE_KEYS.settings, next);
  return next;
}

export function isCompareUnlocked(): boolean {
  const { compareUnlockedAt } = getSettings();
  if (!compareUnlockedAt) return false;

  const unlockedAtMs = new Date(compareUnlockedAt).getTime();
  if (Number.isNaN(unlockedAtMs)) return false;

  const hoursSince = (Date.now() - unlockedAtMs) / (60 * 60 * 1000);
  return hoursSince <= COMPARE_UNLOCK_HOURS;
}

export function unlockCompare(): AppSettings {
  return saveSettings({ compareUnlockedAt: new Date().toISOString() });
}

// ── src/lib/contract.ts 호환 래퍼 ──────────────────────────────────────────
// contract.ts는 이 패킷이 updateSettings를 async로 export한다고 가정한다. 다만
// contract.ts의 인라인 Settings 타입(isPremium/premiumExpiresAt/adCountFree/theme)은
// spec.md 및 packet-0006 테스트로 고정된 @/lib/types의 AppSettings와 어긋난 구버전
// 초안이다(src/domain/subscriptions.ts의 동일 사례 참조) — 실제 도메인 타입은
// AppSettings를 따르고, 이름·비동기 시그니처만 계약을 지킨다.
export async function updateSettings(data: Partial<AppSettings>): Promise<AppSettings> {
  return saveSettings(data);
}
