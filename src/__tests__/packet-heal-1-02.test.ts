import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { screen, within } from "@testing-library/react";
import { mockTds, mockAppsInToss, mockTossRewardAd } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import { STORAGE_KEYS } from "@/lib/constants";
import { getToday } from "@/domain/calc";
import type { Subscription } from "@/lib/types";

// react-router-dom is mocked directly here (not via mockRouter()) because AC-4 needs the
// REAL useLocation() so MemoryRouter's initialEntries state is honored.
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

const DDAY_CARD_FILE = path.resolve(__dirname, "../components/DdayCard.tsx");
const SUBSCRIPTION_LIST_FILE = path.resolve(__dirname, "../components/SubscriptionList.tsx");
const HOME_FILE = path.resolve(__dirname, "../pages/Home.tsx");

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

describe("대시보드 D-day 카드 + 구독 목록 복구 (0010 재작업)", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    (appsInToss.generateHapticFeedback as ReturnType<typeof vi.fn>).mockClear();
  });

  // ========== AC-1 ==========
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

  // ========== AC-2 ==========
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

    it("AC-2[P0]: '해지 준비' 버튼은 display=\"block\" 전체폭이다 (좌측 글자폭 금지)", () => {
      const sub = makeSub({ id: "sub-3b", nextBillingDate: addDays(getToday(), 0) });
      renderWithRouter(React.createElement(DdayCard, { items: [sub] }));

      const btn = screen.getByRole("button", { name: "해지 준비" });
      expect(btn.getAttribute("display")).toBe("block");
    });
  });

  // ========== AC-3 ==========
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

  // ========== AC-4 ==========
  describe("AC-4: location.state.toastMessage가 있으면 토스트가 2초 노출 후 사라지고 state가 초기화된다", () => {
    it(
      "AC-4[P0]: toast shows the message, disappears after 2s, and clears location state (replace navigate with state:null)",
      async () => {
        seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [makeSub({ id: "sub-7" })] });
        renderWithRouter(React.createElement(Home), {
          initialEntries: [{ pathname: "/", state: { toastMessage: "구독을 등록했어요" } }],
        });

        await screen.findByText("구독을 등록했어요");

        // 실 setTimeout 경과를 기다려 자동 소멸을 검증한다 (fake timer는 이미 스케줄된
        // 실 타이머를 가로채지 못해 오탐을 만들 수 있어 지양).
        await new Promise((resolve) => setTimeout(resolve, 2100));

        expect(screen.queryByText("구독을 등록했어요")).not.toBeInTheDocument();
        expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true, state: null });
      },
      5000,
    );

    it("AC-4[P0]: location.state가 없으면(직접 진입) 토스트가 렌더되지 않는다", () => {
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [makeSub({ id: "sub-7b" })] });
      renderWithRouter(React.createElement(Home), {
        initialEntries: ["/"],
      });

      expect(screen.queryByRole("status", { name: "" })).toBeNull();
      expect(mockNavigate).not.toHaveBeenCalledWith("/", { replace: true, state: null });
    });
  });

  // ========== AC-5 ==========
  describe("AC-5: Home 렌더 시 console.error 0건, 추가 파일에 HEX 리터럴 0건", () => {
    it("AC-5[P0]: Home을 렌더해도 console.error가 호출되지 않는다", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [makeSub({ id: "sub-8" })] });

      renderWithRouter(React.createElement(Home), { initialEntries: ["/"] });
      await screen.findByTestId("screen-home");

      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it("AC-5[P0]: DdayCard/SubscriptionList/Home 소스에 HEX 색상 리터럴이 없다", () => {
      const hexPattern = /#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?(?![0-9A-Za-z])/;
      const ddayCardSource = fs.readFileSync(DDAY_CARD_FILE, "utf-8");
      const subscriptionListSource = fs.readFileSync(SUBSCRIPTION_LIST_FILE, "utf-8");
      const homeSource = fs.readFileSync(HOME_FILE, "utf-8");

      expect(ddayCardSource).not.toMatch(hexPattern);
      expect(subscriptionListSource).not.toMatch(hexPattern);
      expect(homeSource).not.toMatch(hexPattern);
    });
  });
});
