import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import { STORAGE_KEYS } from "@/lib/constants";
import type { AppSettings } from "@/lib/types";

mockTds();
mockAppsInToss();

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

import Premium from "@/pages/Premium";
import { IAP } from "@apps-in-toss/web-framework";

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

function getStoredSettings(): AppSettings {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) ?? "{}") as AppSettings;
}

const PURCHASE_BUTTON_NAME = /프리미엄 시작하기/;

function renderPremium(state: { source: string } | null = null) {
  return renderWithRouter(React.createElement(Premium), {
    initialEntries: [{ pathname: "/premium", state }],
  });
}

describe("프리미엄 화면 /premium (IAP) [packet-0017]", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.mocked(IAP.createOneTimePurchaseOrder).mockClear();
  });

  // ========== AC-1 ==========
  describe("AC-1: 비프리미엄 상태에서 결제 버튼과 혜택 3개가 렌더된다", () => {
    it("AC-1[P0]: renders the TossPurchase button (sku from env) and 3 benefit ListRows", () => {
      seedLocalStorage({ [STORAGE_KEYS.settings]: makeSettings({ isPremium: false }) });

      renderPremium();

      const button = screen.getByRole("button", { name: PURCHASE_BUTTON_NAME });
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();

      expect(screen.getByText(/구독 무제한/)).toBeInTheDocument();
      expect(screen.getByText(/광고 제거/)).toBeInTheDocument();
      expect(screen.getByText(/비교 리포트 상시/)).toBeInTheDocument();
    });

    it("AC-1[P0]: clicking the purchase button invokes IAP with sku=import.meta.env.VITE_TOSS_IAP_SKU", async () => {
      seedLocalStorage({ [STORAGE_KEYS.settings]: makeSettings({ isPremium: false }) });

      renderPremium();
      fireEvent.click(screen.getByRole("button", { name: PURCHASE_BUTTON_NAME }));

      await waitFor(() => {
        expect(IAP.createOneTimePurchaseOrder).toHaveBeenCalledTimes(1);
      });
      const call = vi.mocked(IAP.createOneTimePurchaseOrder).mock.calls[0][0] as {
        options: { sku: string };
      };
      expect(call.options.sku).toBe(import.meta.env.VITE_TOSS_IAP_SKU);
    });
  });

  // ========== AC-2 ==========
  describe("AC-2: 결제 성공 시 isPremium/premiumGrantedAt이 저장되고 새로고침 후에도 유지된다", () => {
    it("AC-2[P0]: purchasing sets settings.isPremium=true and premiumGrantedAt to an ISO string", async () => {
      seedLocalStorage({ [STORAGE_KEYS.settings]: makeSettings({ isPremium: false }) });

      renderPremium();
      fireEvent.click(screen.getByRole("button", { name: PURCHASE_BUTTON_NAME }));

      await waitFor(() => {
        expect(getStoredSettings().isPremium).toBe(true);
      });
      const stored = getStoredSettings();
      expect(stored.premiumGrantedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(new Date(stored.premiumGrantedAt as string).toString()).not.toBe("Invalid Date");
    });

    it("AC-2[P0]: premium state survives a fresh mount (simulated refresh) after purchase", async () => {
      seedLocalStorage({ [STORAGE_KEYS.settings]: makeSettings({ isPremium: false }) });

      const { unmount } = renderPremium();
      fireEvent.click(screen.getByRole("button", { name: PURCHASE_BUTTON_NAME }));
      await waitFor(() => {
        expect(getStoredSettings().isPremium).toBe(true);
      });
      unmount();

      renderPremium();

      expect(screen.getByText("프리미엄 이용 중이에요")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: PURCHASE_BUTTON_NAME })).not.toBeInTheDocument();
    });
  });

  // ========== AC-3 ==========
  describe("AC-3: 이미 프리미엄이면 결제 버튼 대신 이용 중 안내가 뜨고 AdSlot이 없다", () => {
    it("AC-3[P0]: when isPremium=true, no purchase button, shows '프리미엄 이용 중이에요', and no AdSlot renders", () => {
      seedLocalStorage({
        [STORAGE_KEYS.settings]: makeSettings({ isPremium: true, premiumGrantedAt: "2026-08-01T00:00:00.000Z" }),
      });

      const { container } = renderPremium();

      expect(screen.queryByRole("button", { name: PURCHASE_BUTTON_NAME })).not.toBeInTheDocument();
      expect(screen.getByText("프리미엄 이용 중이에요")).toBeInTheDocument();
      expect(container.querySelector("[data-ad-group-id]")).toBeNull();
    });
  });

  // ========== AC-4 ==========
  describe("AC-4: state.source==='limit'이면 무료 한도 안내가 추가로 표시되고, state가 null이어도 크래시 없이 렌더된다", () => {
    it("AC-4[P0]: state.source='limit' shows '무료 플랜은 3개까지예요' banner", () => {
      seedLocalStorage({ [STORAGE_KEYS.settings]: makeSettings({ isPremium: false }) });

      renderPremium({ source: "limit" });

      expect(screen.getByText("무료 플랜은 3개까지예요")).toBeInTheDocument();
    });

    it("AC-4[P0]: null location.state renders without crashing and omits the limit banner", () => {
      seedLocalStorage({ [STORAGE_KEYS.settings]: makeSettings({ isPremium: false }) });

      renderPremium(null);

      expect(screen.getByTestId("screen-premium")).toBeInTheDocument();
      expect(screen.queryByText("무료 플랜은 3개까지예요")).not.toBeInTheDocument();
    });
  });

  // ========== AC-5 ==========
  describe("AC-5: 루트가 ScreenScaffold(screen-premium)이다", () => {
    it("AC-5[P0]: root carries data-testid='screen-premium'", () => {
      seedLocalStorage({ [STORAGE_KEYS.settings]: makeSettings({ isPremium: false }) });

      renderPremium();

      expect(screen.getByTestId("screen-premium")).toBeInTheDocument();
    });
  });
});
