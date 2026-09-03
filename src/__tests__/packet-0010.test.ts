import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, within } from "@testing-library/react";
import { mockTds, mockAppsInToss, mockTossRewardAd } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import { STORAGE_KEYS } from "@/lib/constants";
import { getToday } from "@/domain/calc";
import type { Subscription } from "@/lib/types";

// ── Mocks ──
// react-router-dom is mocked directly here (not via the shared mockRouter() helper) because
// AC-4 needs the REAL useLocation() so MemoryRouter's initialEntries state is honored —
// mockRouter() stubs useLocation to a static object, which would make location.state always null.
mockTds();
mockAppsInToss();
mockTossRewardAd();

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

import * as appsInToss from "@apps-in-toss/web-framework";
import { DdayCard } from "@/components/DdayCard";
import { SubscriptionList } from "@/components/SubscriptionList";
import Home from "@/pages/Home";

// ── Fixtures ──
// addDays computes YYYY-MM-DD strings the same way domain/calc's daysUntil compares them
// (Date.UTC on parsed y/m/d parts), so "D-N" assertions stay exact regardless of test-runner TZ.
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: overrides.id ?? "sub-1",
    name: "넷플릭스",
    category: "OTT",
    iconKey: "netflix",
    amount: 13500,
    cycle: "MONTHLY",
    firstBillingDate: "2026-08-04",
    nextBillingDate: addDays(getToday(), 2),
    memo: "",
    status: "ACTIVE",
    priceHistory: [],
    createdAt: "2026-08-04T00:00:00Z",
    updatedAt: "2026-08-04T00:00:00Z",
    ...overrides,
  };
}

describe("대시보드 — D-day 카드 + 구독 목록 [packet-0010]", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    (appsInToss.generateHapticFeedback as ReturnType<typeof vi.fn>).mockClear();
  });

  // ========== AC-1: D-day 카드 / 다음 결제 안내 분기 ==========
  // DdayCard는 이미 결제임박순(nextBillingDate 오름차순)으로 정렬·필터된 items를 받아
  // items[0](가장 임박한 구독) 기준으로 분기한다 — useSubscriptions().upcoming과 동일한 계약.
  describe("AC-1: dday<=3인 구독 유무에 따라 dday-card / dday-next로 분기한다", () => {
    it("AC-1[P0]: dday<=3인 구독이 있으면 dday-card에 이름·D-day·금액이 렌더된다", () => {
      const sub = makeSub({ id: "sub-1", name: "넷플릭스", amount: 13500, nextBillingDate: addDays(getToday(), 2) });
      renderWithRouter(React.createElement(DdayCard, { items: [sub] }));

      const card = screen.getByTestId("dday-card");
      expect(card.textContent).toContain("넷플릭스");
      expect(card.textContent).toContain("D-2");
      expect(card.textContent).toContain("13,500원");
      expect(screen.queryByTestId("dday-next")).not.toBeInTheDocument();
    });

    it("AC-1[P0]: dday<=3인 구독이 없으면 dday-next에 '다음 결제는 D-N 이름'이 렌더된다", () => {
      const sub = makeSub({ id: "sub-2", name: "스포티파이", nextBillingDate: addDays(getToday(), 5) });
      renderWithRouter(React.createElement(DdayCard, { items: [sub] }));

      const next = screen.getByTestId("dday-next");
      expect(next.textContent).toContain("다음 결제는 D-5 스포티파이");
      expect(screen.queryByTestId("dday-card")).not.toBeInTheDocument();
    });
  });

  // ========== AC-2: '해지 준비' 탭 ==========
  describe("AC-2: '해지 준비' 탭 시 haptic tickWeak 후 체크리스트로 이동한다", () => {
    it("AC-2[P0]: click fires tickWeak haptic and navigates to /subscriptions/:id/checklist with {subscriptionId, from:'dday'}", () => {
      const sub = makeSub({ id: "sub-3", name: "넷플릭스", amount: 13500, nextBillingDate: addDays(getToday(), 1) });
      renderWithRouter(React.createElement(DdayCard, { items: [sub] }));

      screen.getByRole("button", { name: "해지 준비" }).click();

      expect(appsInToss.generateHapticFeedback).toHaveBeenCalledWith({ type: "tickWeak" });
      expect(mockNavigate).toHaveBeenCalledWith("/subscriptions/sub-3/checklist", {
        state: { subscriptionId: "sub-3", from: "dday" },
      });
    });
  });

  // ========== AC-3: 목록 탭 이동 + 인상 배지 ==========
  describe("AC-3: ListRow 탭 시 상세로 이동하고, 가격 인상 항목만 배지가 붙는다", () => {
    it("AC-3[P0]: ListRow 탭 시 /subscriptions/:id로 subscriptionId state와 함께 이동한다", () => {
      const subs = [makeSub({ id: "sub-4", name: "유튜브 프리미엄" })];
      renderWithRouter(React.createElement(SubscriptionList, { items: subs }));

      screen.getAllByRole("listitem")[0].click();

      expect(mockNavigate).toHaveBeenCalledWith("/subscriptions/sub-4", {
        state: { subscriptionId: "sub-4" },
      });
    });

    it("AC-3[P0]: priceHistory가 1건 이상인 항목에만 data-testid='price-up-badge'가 붙는다", () => {
      const subs = [
        makeSub({
          id: "sub-5",
          name: "넷플릭스",
          priceHistory: [{ id: "p1", amount: 13500, changedAt: "2026-01-01", note: "인상" }],
        }),
        makeSub({ id: "sub-6", name: "왓챠", priceHistory: [] }),
      ];
      renderWithRouter(React.createElement(SubscriptionList, { items: subs }));

      const netflixRow = screen.getByText("넷플릭스").closest('[role="listitem"]') as HTMLElement;
      const watchaRow = screen.getByText("왓챠").closest('[role="listitem"]') as HTMLElement;

      expect(within(netflixRow).getByTestId("price-up-badge")).toBeInTheDocument();
      expect(within(watchaRow).queryByTestId("price-up-badge")).not.toBeInTheDocument();
    });
  });

  // ========== AC-4: 진입 토스트 ==========
  describe("AC-4: location.state.toastMessage가 있으면 토스트가 2초 노출 후 사라지고 state가 초기화된다", () => {
    it(
      "AC-4[P0]: toast shows the message, disappears after 2s, and clears location state (replace navigate with state:null)",
      async () => {
        seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [makeSub({ id: "sub-7" })] });
        renderWithRouter(React.createElement(Home), {
          initialEntries: [{ pathname: "/", state: { toastMessage: "구독을 등록했어요" } }],
        });

        await screen.findByText("구독을 등록했어요");

        // 실제 setTimeout 경과를 기다려 자동 소멸을 검증한다 (fake timer는 이미 스케줄된
        // 실 타이머를 가로채지 못해 오탐을 만들 수 있어 지양).
        await new Promise((resolve) => setTimeout(resolve, 2100));

        expect(screen.queryByText("구독을 등록했어요")).not.toBeInTheDocument();
        expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true, state: null });
      },
      5000,
    );
  });

  // ========== AC-5: 대량 목록 초기 렌더 제한 ==========
  describe("AC-5: 항목이 50건을 넘으면 초기 DOM의 ListRow 개수가 20 이하다", () => {
    it("AC-5[P0]: 60건을 넘겨도 처음 렌더되는 listitem은 20개 이하다", () => {
      const subs = Array.from({ length: 60 }, (_, i) =>
        makeSub({ id: `sub-bulk-${i}`, name: `구독-${i}`, nextBillingDate: addDays(getToday(), i + 10) }),
      );
      renderWithRouter(React.createElement(SubscriptionList, { items: subs }));

      const rows = screen.getAllByRole("listitem");
      expect(rows.length).toBeLessThanOrEqual(20);
      expect(rows.length).toBeGreaterThan(0);
    });
  });
});
