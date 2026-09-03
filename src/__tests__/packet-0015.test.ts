import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import { STORAGE_KEYS, BENCHMARK_DISCLAIMER, COMPARE_UNLOCK_HOURS } from "@/lib/constants";
import type { AppSettings, Subscription } from "@/lib/types";

// ── Mocks ──
// TossRewardAd is intentionally NOT mocked (unlike mockAll()'s mockTossRewardAd, which
// bypasses the gate entirely and would make AC-2/AC-3's gating behavior untestable).
// The real component is exercised against the mocked SDK (loadFullScreenAd/showFullScreenAd)
// from mockAppsInToss(), which fires onEvent via setTimeout(0) — faithful to production timing.
mockTds();
mockAppsInToss();

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

import Compare from "@/pages/Compare";
import App from "@/App";

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    ageBand: "UNSET",
    isPremium: false,
    premiumGrantedAt: null,
    compareUnlockedAt: null,
    onboardedAt: null,
    ...overrides,
  };
}

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: overrides.id ?? "sub-1",
    name: "넷플릭스",
    category: "OTT",
    iconKey: "netflix",
    amount: 9900,
    cycle: "MONTHLY",
    firstBillingDate: "2026-08-04",
    nextBillingDate: "2099-01-04",
    memo: "가족과 함께 공유 중",
    status: "ACTIVE",
    priceHistory: [],
    createdAt: "2026-08-04T00:00:00Z",
    updatedAt: "2026-08-04T00:00:00Z",
    ...overrides,
  };
}

function getStoredSettings(): AppSettings {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) ?? "{}") as AppSettings;
}

function seedSubscription() {
  seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [makeSub()] });
}

function getAgeBandChips(): HTMLElement[] {
  return screen.getAllByRole("button").filter((el) => el.hasAttribute("aria-pressed"));
}

async function watchAdGate(): Promise<void> {
  const gateButton = await screen.findByRole("button", { name: /광고/ });
  await waitFor(() => expect(gateButton).not.toBeDisabled());
  fireEvent.click(gateButton);
}

describe("또래 비교 화면 /compare (리워드 광고 게이팅) [packet-0015]", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  // ========== AC-1 ==========
  describe("AC-1: ageBand가 UNSET이면 연령대 Chip 선택 UI만 보이고 결과 영역은 렌더되지 않는다", () => {
    it("AC-1[P0]: shows at least 4 age band chips and renders no result/disclaimer/ad-gate", async () => {
      seedSubscription();
      seedLocalStorage({ [STORAGE_KEYS.settings]: makeSettings({ ageBand: "UNSET" }) });

      renderWithRouter(React.createElement(Compare));

      await waitFor(() => {
        expect(getAgeBandChips().length).toBeGreaterThanOrEqual(4);
      });

      expect(screen.queryByText(BENCHMARK_DISCLAIMER)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /광고/ })).not.toBeInTheDocument();
    });

    it("AC-1[P0]: root is ScreenScaffold with data-testid='screen-compare' even before a band is picked", async () => {
      seedSubscription();
      seedLocalStorage({ [STORAGE_KEYS.settings]: makeSettings({ ageBand: "UNSET" }) });

      renderWithRouter(React.createElement(Compare));

      await waitFor(() => {
        expect(screen.getByTestId("screen-compare")).toBeInTheDocument();
      });
    });
  });

  // ========== AC-2 ==========
  describe("AC-2: 연령대 선택 후 광고 게이트가 보이며 시청 완료 시 결과가 노출되고 compareUnlockedAt이 저장된다", () => {
    it("AC-2[P0]: picking a chip persists ageBand and reveals the reward-ad gate (result stays hidden)", async () => {
      seedSubscription();
      seedLocalStorage({ [STORAGE_KEYS.settings]: makeSettings({ ageBand: "UNSET" }) });

      renderWithRouter(React.createElement(Compare));

      await waitFor(() => {
        expect(getAgeBandChips().length).toBeGreaterThanOrEqual(4);
      });

      fireEvent.click(getAgeBandChips()[0]);

      await waitFor(() => {
        expect(["20-24", "25-29", "30-34", "35-39"]).toContain(getStoredSettings().ageBand);
      });

      expect(await screen.findByRole("button", { name: /광고/ })).toBeInTheDocument();
      expect(screen.queryByText(BENCHMARK_DISCLAIMER)).not.toBeInTheDocument();
    });

    it("AC-2[P0]: watching the reward ad to completion reveals the result and persists compareUnlockedAt", async () => {
      seedSubscription();
      seedLocalStorage({ [STORAGE_KEYS.settings]: makeSettings({ ageBand: "UNSET" }) });

      renderWithRouter(React.createElement(Compare));

      await waitFor(() => {
        expect(getAgeBandChips().length).toBeGreaterThanOrEqual(4);
      });
      fireEvent.click(getAgeBandChips()[0]);

      await watchAdGate();

      await waitFor(() => {
        expect(screen.getByText(BENCHMARK_DISCLAIMER)).toBeInTheDocument();
      });

      const saved = getStoredSettings();
      expect(saved.compareUnlockedAt).not.toBeNull();
      expect(Number.isNaN(new Date(saved.compareUnlockedAt as string).getTime())).toBe(false);
      const minutesSinceUnlock = (Date.now() - new Date(saved.compareUnlockedAt as string).getTime()) / 60000;
      expect(minutesSinceUnlock).toBeLessThan(1);
    });
  });

  // ========== AC-3 ==========
  describe("AC-3: compareUnlockedAt이 24시간 이내면 바로 결과가, 25시간 경과 시 다시 광고 게이트가 보인다", () => {
    it("AC-3[P0]: unlocked 2 hours ago -> result renders immediately without any ad gate", async () => {
      seedSubscription();
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      seedLocalStorage({
        [STORAGE_KEYS.settings]: makeSettings({ ageBand: "25-29", compareUnlockedAt: twoHoursAgo }),
      });

      renderWithRouter(React.createElement(Compare));

      await waitFor(() => {
        expect(screen.getByText(BENCHMARK_DISCLAIMER)).toBeInTheDocument();
      });
      expect(screen.queryByRole("button", { name: /광고/ })).not.toBeInTheDocument();
    });

    it("AC-3[P0]: unlocked 25 hours ago (past COMPARE_UNLOCK_HOURS=24) -> ad gate shows again, result hidden", async () => {
      seedSubscription();
      const twentyFiveHoursAgo = new Date(
        Date.now() - (COMPARE_UNLOCK_HOURS + 1) * 60 * 60 * 1000,
      ).toISOString();
      seedLocalStorage({
        [STORAGE_KEYS.settings]: makeSettings({ ageBand: "25-29", compareUnlockedAt: twentyFiveHoursAgo }),
      });

      renderWithRouter(React.createElement(Compare));

      expect(await screen.findByRole("button", { name: /광고/ })).toBeInTheDocument();
      expect(screen.queryByText(BENCHMARK_DISCLAIMER)).not.toBeInTheDocument();
    });
  });

  // ========== AC-4 ==========
  describe("AC-4: 결과 화면에 BENCHMARK_DISCLAIMER 문구가 항상 함께 렌더된다", () => {
    it("AC-4[P0]: exact BENCHMARK_DISCLAIMER text from constants.ts is present alongside the unlocked result", async () => {
      seedSubscription();
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      seedLocalStorage({
        [STORAGE_KEYS.settings]: makeSettings({ ageBand: "30-34", compareUnlockedAt: oneHourAgo }),
      });

      renderWithRouter(React.createElement(Compare));

      await waitFor(() => {
        expect(screen.getByText(BENCHMARK_DISCLAIMER)).toBeInTheDocument();
      });
    });
  });

  // ========== AC-5 ==========
  describe("AC-5: 생성형 AI 라벨이 없고 루트가 ScreenScaffold(screen-compare)이다", () => {
    it("AC-5[P0]: no 'AI가 생성한 결과입니다' label anywhere, and root carries data-testid='screen-compare'", async () => {
      seedSubscription();
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      seedLocalStorage({
        [STORAGE_KEYS.settings]: makeSettings({ ageBand: "35-39", compareUnlockedAt: oneHourAgo }),
      });

      renderWithRouter(React.createElement(Compare));

      await waitFor(() => {
        expect(screen.getByTestId("screen-compare")).toBeInTheDocument();
      });
      expect(screen.queryByText("AI가 생성한 결과입니다")).not.toBeInTheDocument();
      expect(screen.queryByText(/AI가 생성한/)).not.toBeInTheDocument();
    });
  });

  // ========== Integration ==========
  describe("integration: App.tsx가 /compare 라우트를 연결한다", () => {
    it("navigating to /compare via App renders the Compare screen", async () => {
      seedSubscription();
      seedLocalStorage({ [STORAGE_KEYS.settings]: makeSettings({ ageBand: "UNSET" }) });

      renderWithRouter(React.createElement(App), { initialEntries: ["/compare"] });

      await waitFor(() => {
        expect(screen.getByTestId("screen-compare")).toBeInTheDocument();
      });
    });
  });
});
