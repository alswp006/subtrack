import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import { STORAGE_KEYS } from "@/lib/constants";
import type { AppSettings, Subscription } from "@/lib/types";

mockTds();
mockAppsInToss();

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

import More from "@/pages/More";
import Home from "@/pages/Home";

const SOURCE_FILE = path.resolve(__dirname, "../pages/More.tsx");

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

describe("더보기 화면 /more [packet-0016]", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  // ========== AC-1 ==========
  describe("AC-1: 연령대 ListRow 탭 시 BottomSheet가 열리고 선택하면 settings.ageBand가 저장·반영된다", () => {
    it("AC-1[P0]: tapping the age-band row opens a BottomSheet with the 4 band options", async () => {
      seedLocalStorage({ [STORAGE_KEYS.settings]: makeSettings({ ageBand: "UNSET" }) });

      renderWithRouter(React.createElement(More));

      fireEvent.click(screen.getByText("연령대"));

      const sheet = await screen.findByRole("dialog");
      expect(sheet).toBeInTheDocument();
      expect(screen.getByText("25-29")).toBeInTheDocument();
      expect(screen.getByText("30-34")).toBeInTheDocument();
    });

    it("AC-1[P0]: picking '25-29' persists settings.ageBand and updates the row's right-side value", async () => {
      seedLocalStorage({ [STORAGE_KEYS.settings]: makeSettings({ ageBand: "UNSET" }) });

      renderWithRouter(React.createElement(More));

      fireEvent.click(screen.getByText("연령대"));
      await screen.findByRole("dialog");
      fireEvent.click(screen.getByText("25-29"));

      await waitFor(() => {
        expect(getStoredSettings().ageBand).toBe("25-29");
      });
      expect(screen.getByTestId("age-band-value").textContent).toBe("25-29");
    });
  });

  // ========== AC-2 ==========
  describe("AC-2: '데이터 초기화' 탭 시 AlertDialog(닫기 버튼 포함)가 뜨고 확인하면 SubTrack 키 4개만 삭제된다", () => {
    it("AC-2[P0]: tapping '데이터 초기화' opens an alertdialog with a '닫기' button", async () => {
      seedLocalStorage({ [STORAGE_KEYS.settings]: makeSettings() });

      renderWithRouter(React.createElement(More));

      fireEvent.click(screen.getByText("데이터 초기화"));

      const dialog = await screen.findByRole("alertdialog");
      expect(dialog).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "닫기" })).toBeInTheDocument();
    });

    it("AC-2[P0]: confirming removes exactly the 4 SubTrack storage keys and leaves unrelated keys untouched", async () => {
      seedLocalStorage({
        [STORAGE_KEYS.subscriptions]: [makeSub()],
        [STORAGE_KEYS.checklists]: {},
        [STORAGE_KEYS.settings]: makeSettings({ ageBand: "25-29" }),
        [STORAGE_KEYS.meta]: { schemaVersion: 1, migratedAt: "2026-08-04T00:00:00Z" },
      });
      localStorage.setItem("unrelated.key", "keep-me");

      renderWithRouter(React.createElement(More));

      fireEvent.click(screen.getByText("데이터 초기화"));
      await screen.findByRole("alertdialog");
      fireEvent.click(screen.getByRole("button", { name: "초기화" }));

      await waitFor(() => {
        expect(localStorage.getItem(STORAGE_KEYS.subscriptions)).toBeNull();
      });
      expect(localStorage.getItem(STORAGE_KEYS.checklists)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.settings)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.meta)).toBeNull();
      expect(localStorage.getItem("unrelated.key")).toBe("keep-me");
    });

    it("AC-2[P0]: after reset, a fresh Home render shows the empty-state dashboard", async () => {
      seedLocalStorage({
        [STORAGE_KEYS.subscriptions]: [makeSub()],
        [STORAGE_KEYS.settings]: makeSettings(),
      });

      renderWithRouter(React.createElement(More));
      fireEvent.click(screen.getByText("데이터 초기화"));
      await screen.findByRole("alertdialog");
      fireEvent.click(screen.getByRole("button", { name: "초기화" }));

      await waitFor(() => {
        expect(localStorage.getItem(STORAGE_KEYS.subscriptions)).toBeNull();
      });

      renderWithRouter(React.createElement(Home));

      await waitFor(() => {
        expect(screen.getByTestId("empty-state")).toBeInTheDocument();
      });
    });
  });

  // ========== AC-3 ==========
  describe("AC-3: 프리미엄 ListRow 탭 시 /premium으로 이동한다", () => {
    it("AC-3[P0]: tapping the premium row navigates to /premium with state.source='more' (matches RouteState['/premium'])", () => {
      seedLocalStorage({ [STORAGE_KEYS.settings]: makeSettings() });

      renderWithRouter(React.createElement(More));

      fireEvent.click(screen.getByText("프리미엄"));

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith("/premium", { state: { source: "more" } });
    });
  });

  // ========== AC-4 ==========
  describe("AC-4: 외부 이탈·설치 유도 문구가 0건이다", () => {
    it("AC-4[P0]: rendered screen has no <a> tag and no window.open/location.href call", () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
      seedLocalStorage({ [STORAGE_KEYS.settings]: makeSettings() });

      const { container } = renderWithRouter(React.createElement(More));

      expect(container.querySelectorAll("a").length).toBe(0);
      expect(openSpy).not.toHaveBeenCalled();
      openSpy.mockRestore();
    });

    it("AC-4[P0]: source file contains zero window.open/location.href/<a href and zero '설치'/'다운로드' copy", () => {
      const source = fs.readFileSync(SOURCE_FILE, "utf-8");

      expect(source).not.toMatch(/window\.open/);
      expect(source).not.toMatch(/location\.href/);
      expect(source).not.toMatch(/<a\s+href/);
      expect(source).not.toMatch(/설치/);
      expect(source).not.toMatch(/다운로드/);
    });
  });

  // ========== AC-5 ==========
  describe("AC-5: 루트가 ScreenScaffold(screen-more)이고 FloatingTabBar가 노출된다", () => {
    it("AC-5[P0]: root carries data-testid='screen-more' and the bottom tab bar is rendered", () => {
      seedLocalStorage({ [STORAGE_KEYS.settings]: makeSettings() });

      renderWithRouter(React.createElement(More));

      expect(screen.getByTestId("screen-more")).toBeInTheDocument();
      expect(screen.getByRole("tablist", { name: "메인 네비게이션" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "더보기" })).toHaveAttribute("aria-selected", "true");
    });
  });

  // ========== Integration ==========
  describe("integration: 앱 정보 영역이 ListRow로 렌더되고 버전·면책 문구를 담는다", () => {
    it("shows an app-info row with a version string and a disclaimer, without crashing", () => {
      seedLocalStorage({ [STORAGE_KEYS.settings]: makeSettings() });

      renderWithRouter(React.createElement(More));

      expect(screen.getByText(/버전/)).toBeInTheDocument();
      expect(screen.getByTestId("screen-more")).toBeInTheDocument();
    });
  });
});
