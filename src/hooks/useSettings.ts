// 설정 상태 훅 — localStorage 읽기가 동기라 로딩 게이트 없이 첫 렌더부터 실제 값을 반환한다.

import { useCallback, useState } from 'react';
import type { AppSettings } from '@/lib/types';
import { getSettings, saveSettings } from '@/domain/settings';

export interface UseSettingsReturn {
  settings: AppSettings;
  isPremium: boolean;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<AppSettings>(() => getSettings());

  const update = useCallback(async (patch: Partial<AppSettings>) => {
    const next = saveSettings(patch);
    setSettings(next);
  }, []);

  return { settings, isPremium: settings.isPremium, update };
}
