import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { screen, waitFor } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import { STORAGE_KEYS } from "@/lib/constants";
import type { Subscription } from "@/lib/types";

mockAll();

import * as appsInToss from "@apps-in-toss/web-framework";
import Home from "@/pages/Home";

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: overrides.id ?? "sub-1",
    name: "넷플릭스",
    category: "OTT",
    iconKey: "netflix",
    amount: 9900,
    cycle: "MONTHLY",
    firstBillingDate: "2026-08-04",
    nextBillingDate: "2026-10-04",
    memo: "",
    status: "ACTIVE",
    priceHistory: [],
    createdAt: "2026-08-04T00:00:00Z",
    updatedAt: "2026-08-04T00:00:00Z",
    ...overrides,
  };
}

describe("대시보드 — 요약 히어로 · 차트 · 빈/로딩 상태 [packet-0009]", () => {
  beforeEach(() => {
    (appsInToss.generateHapticFeedback as ReturnType<typeof vi.fn>).mockClear();
    mockNavigate.mockClear();
  });

  // ========== AC-1: Loading state ==========
  describe("AC-1: loading 상태에서는 스켈레톤만 보이고 빈 상태 문구가 없다", () => {
    it("AC-1[P0]: renders hero-skeleton + 3 skeleton ListRow blocks on first render (before storage read resolves)", () => {
      renderWithRouter(React.createElement(Home));

      expect(screen.getByTestId("hero-skeleton")).toBeInTheDocument();
      expect(screen.getAllByTestId("skeleton-block").length).toBeGreaterThanOrEqual(3);
    });

    it("AC-1[P0]: does not render the empty-state copy while loading", () => {
      renderWithRouter(React.createElement(Home));

      expect(screen.queryByText("아직 등록한 구독이 없어요")).not.toBeInTheDocument();
      expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
      expect(screen.queryByTestId("summary-hero")).not.toBeInTheDocument();
    });
  });

  // ========== AC-2: Empty state ==========
  describe("AC-2: 구독 0건이면 EmptyState가 보이고 SummaryHero/차트는 숨는다", () => {
    it("AC-2[P0]: shows empty-state with '아직 등록한 구독이 없어요' once storage read resolves to []", async () => {
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [] });
      renderWithRouter(React.createElement(Home));

      await waitFor(() => {
        expect(screen.getByTestId("empty-state")).toBeInTheDocument();
      });

      expect(screen.getByText("아직 등록한 구독이 없어요")).toBeInTheDocument();
      expect(screen.queryByTestId("summary-hero")).not.toBeInTheDocument();
    });

    it("AC-2[P0]: hides SummaryHero/Sparkline/MiniBar and shows '첫 구독 등록하기' as the primary action label", async () => {
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [] });
      renderWithRouter(React.createElement(Home));

      await waitFor(() => {
        expect(screen.getByTestId("empty-state")).toBeInTheDocument();
      });

      expect(document.querySelector("svg[aria-label='최근 추이 그래프']")).toBeNull();
      expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
      expect(
        screen.getByRole("button", { name: "첫 구독 등록하기" }),
      ).toBeInTheDocument();
    });
  });

  // ========== AC-3: Ready state with data ==========
  describe("AC-3: 구독 1건 이상이면 월 환산 합계와 활성/해지 카운트가 표시된다", () => {
    it("AC-3[P0]: summary-hero shows the active monthly total formatted as '24,900원'", async () => {
      const subs: Subscription[] = [
        makeSub({ id: "sub-1", amount: 9900, cycle: "MONTHLY", status: "ACTIVE" }),
        makeSub({ id: "sub-2", amount: 15000, cycle: "MONTHLY", status: "ACTIVE" }),
        makeSub({ id: "sub-3", amount: 5000, cycle: "MONTHLY", status: "CANCELED" }),
      ];
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: subs });
      renderWithRouter(React.createElement(Home));

      await waitFor(() => {
        expect(screen.getByTestId("summary-hero")).toBeInTheDocument();
      });

      const hero = screen.getByTestId("summary-hero");
      expect(hero.textContent).toContain((24900).toLocaleString("ko-KR") + "원");
      expect(hero.textContent).toContain("활성 2개 · 해지함 1개");
    });

    it("AC-3[P0]: does not render the empty-state copy once data exists", async () => {
      const subs: Subscription[] = [makeSub({ id: "sub-1" })];
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: subs });
      renderWithRouter(React.createElement(Home));

      await waitFor(() => {
        expect(screen.getByTestId("summary-hero")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
      expect(screen.queryByText("아직 등록한 구독이 없어요")).not.toBeInTheDocument();
    });

    it("AC-3: renders without crashing when the subscriptions storage entry is malformed JSON", async () => {
      localStorage.setItem(STORAGE_KEYS.subscriptions, "{not-valid-json");
      renderWithRouter(React.createElement(Home));

      await waitFor(() => {
        expect(screen.getByTestId("screen-home")).toBeInTheDocument();
      });

      // malformed storage normalizes to an empty list, so the empty state should render (no crash/white screen)
      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });
  });

  // ========== AC-4: '구독 추가' CTA ==========
  describe("AC-4: '구독 추가' 버튼 탭 시 햅틱 후 /subscriptions/new 로 이동한다", () => {
    it("AC-4[P0]: clicking the primary CTA fires success haptic feedback and navigates to /subscriptions/new", async () => {
      const subs: Subscription[] = [makeSub({ id: "sub-1" })];
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: subs });
      renderWithRouter(React.createElement(Home));

      await waitFor(() => {
        expect(screen.getByTestId("summary-hero")).toBeInTheDocument();
      });

      const cta = screen.getByRole("button", { name: "구독 추가" });
      cta.click();

      expect(appsInToss.generateHapticFeedback).toHaveBeenCalledWith({ type: "success" });
      expect(mockNavigate).toHaveBeenCalledWith("/subscriptions/new");
    });

    it("AC-4[P0]: from the empty state, the '첫 구독 등록하기' CTA also navigates to /subscriptions/new", async () => {
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [] });
      renderWithRouter(React.createElement(Home));

      await waitFor(() => {
        expect(screen.getByTestId("empty-state")).toBeInTheDocument();
      });

      const cta = screen.getByRole("button", { name: "첫 구독 등록하기" });
      cta.click();

      expect(mockNavigate).toHaveBeenCalledWith("/subscriptions/new");
    });
  });

  // ========== AC-5: Scaffold + tap target sizing ==========
  describe("AC-5: 루트가 ScreenScaffold(screen-home)이고 탭 요소가 44px 이상이다", () => {
    it("AC-5[P0]: root carries data-testid='screen-home' and contains a bottom tab list", async () => {
      const subs: Subscription[] = [makeSub({ id: "sub-1" })];
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: subs });
      renderWithRouter(React.createElement(Home));

      await waitFor(() => {
        expect(screen.getByTestId("summary-hero")).toBeInTheDocument();
      });

      const root = screen.getByTestId("screen-home");
      expect(root).toBeInTheDocument();
      const tabs = screen.getAllByRole("tab");
      expect(tabs.length).toBeGreaterThanOrEqual(2);
      expect(root.contains(tabs[0])).toBe(true);
    });

    it("AC-5[P0]: every tab element has an inline min-height/height of at least 44px", async () => {
      const subs: Subscription[] = [makeSub({ id: "sub-1" })];
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: subs });
      renderWithRouter(React.createElement(Home));

      await waitFor(() => {
        expect(screen.getByTestId("summary-hero")).toBeInTheDocument();
      });

      const tabs = screen.getAllByRole("tab");
      tabs.forEach((tab) => {
        const el = tab as HTMLElement;
        const declared = el.style.minHeight || el.style.height;
        expect(parseFloat(declared)).toBeGreaterThanOrEqual(44);
      });
    });
  });
});
