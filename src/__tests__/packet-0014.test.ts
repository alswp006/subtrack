import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { Routes, Route } from "react-router-dom";
import { screen, within, fireEvent, waitFor } from "@testing-library/react";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import { STORAGE_KEYS, DEFAULT_CHECKLIST } from "@/lib/constants";
import { monthlyAmount } from "@/domain/calc";
import type { Subscription, CancelChecklist } from "@/lib/types";

mockAll();

import Checklist from "@/pages/Checklist";

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

// Checklist는 useParams로 라우트 param을 읽으므로, 실제 <Route path="/subscriptions/:id/checklist">
// 매칭 안에서 렌더해야 id가 주입된다 (packet-0012/0013과 동일 패턴).
function renderChecklist(id: string) {
  return renderWithRouter(
    React.createElement(
      Routes,
      null,
      React.createElement(Route, {
        path: "/subscriptions/:id/checklist",
        element: React.createElement(Checklist),
      }),
    ),
    { initialEntries: [`/subscriptions/${id}/checklist`] },
  );
}

function getStoredSub(id: string): Subscription | undefined {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.subscriptions) ?? "[]") as Subscription[];
  return stored.find((s) => s.id === id);
}

function getStoredChecklist(id: string): CancelChecklist | undefined {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.checklists) ?? "{}") as Record<
    string,
    CancelChecklist
  >;
  return stored[id];
}

function getRowByLabel(label: string): HTMLElement {
  const labelEl = screen.getByText(label);
  const row = labelEl.closest('[role="listitem"]');
  expect(row).not.toBeNull();
  return row as HTMLElement;
}

const COMPLETE_BUTTON_NAME = "해지 완료로 표시";

describe("해지 체크리스트 화면 /subscriptions/:id/checklist [packet-0014]", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  // ========== AC-1 ==========
  describe("AC-1: 체크리스트 5개 항목이 ListRow + Switch로 렌더되고 토글 시 haptic + 즉시 저장 + 새로고침 유지", () => {
    it("AC-1[P0]: renders all 5 DEFAULT_CHECKLIST labels as switches, all unchecked initially", async () => {
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [makeSub({ id: "sub-1" })] });

      renderChecklist("sub-1");

      await waitFor(() => {
        expect(screen.getAllByRole("switch")).toHaveLength(DEFAULT_CHECKLIST.length);
      });

      for (const item of DEFAULT_CHECKLIST) {
        const row = getRowByLabel(item.label);
        expect(within(row).getByRole("switch")).not.toBeChecked();
      }
    });

    it("AC-1[P0]: toggling a switch fires tickWeak haptic, saves immediately, and stays checked after remount (refresh)", async () => {
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [makeSub({ id: "sub-1" })] });

      const { unmount } = renderChecklist("sub-1");

      await waitFor(() => {
        expect(screen.getAllByRole("switch")).toHaveLength(DEFAULT_CHECKLIST.length);
      });

      const firstLabel = DEFAULT_CHECKLIST[0].label;
      const switchEl = within(getRowByLabel(firstLabel)).getByRole("switch");
      fireEvent.click(switchEl);

      expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "tickWeak" });

      const savedChecklist = getStoredChecklist("sub-1");
      expect(savedChecklist).toBeDefined();
      expect(savedChecklist?.items.find((i) => i.label === firstLabel)?.done).toBe(true);

      unmount();

      renderChecklist("sub-1");

      await waitFor(() => {
        expect(screen.getAllByRole("switch")).toHaveLength(DEFAULT_CHECKLIST.length);
      });

      expect(within(getRowByLabel(firstLabel)).getByRole("switch")).toBeChecked();
    });
  });

  // ========== AC-2 ==========
  describe("AC-2: 상단 진행률 텍스트가 완료 개수에 따라 갱신된다", () => {
    it("AC-2[P0]: shows '0/5 완료' initially and '2/5 완료' after toggling two items on", async () => {
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [makeSub({ id: "sub-1" })] });

      renderChecklist("sub-1");

      await waitFor(() => {
        expect(screen.getByText("0/5 완료")).toBeInTheDocument();
      });

      fireEvent.click(within(getRowByLabel(DEFAULT_CHECKLIST[0].label)).getByRole("switch"));
      fireEvent.click(within(getRowByLabel(DEFAULT_CHECKLIST[1].label)).getByRole("switch"));

      expect(screen.getByText("2/5 완료")).toBeInTheDocument();
      expect(screen.queryByText("0/5 완료")).not.toBeInTheDocument();
    });
  });

  // ========== AC-3 ==========
  describe("AC-3: 화면에 앱 설치 유도 문구·외부 링크가 없다", () => {
    it("AC-3[P0]: contains no install-app copy, no <a href>, and never calls window.open", async () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [makeSub({ id: "sub-1" })] });

      const { container } = renderChecklist("sub-1");

      await waitFor(() => {
        expect(screen.getAllByRole("switch")).toHaveLength(DEFAULT_CHECKLIST.length);
      });

      const text = container.textContent ?? "";
      for (const forbidden of ["앱을 설치", "다운로드", "설치하기", "스토어에서"]) {
        expect(text).not.toContain(forbidden);
      }
      expect(container.querySelectorAll("a[href]")).toHaveLength(0);
      expect(openSpy).not.toHaveBeenCalled();

      openSpy.mockRestore();
    });
  });

  // ========== AC-4 ==========
  describe("AC-4: '해지 완료로 표시' 탭 시 status가 CANCELED로 바뀌고 상세로 이동하며 대시보드 총액에서 제외된다", () => {
    it("AC-4[P0]: marks the subscription CANCELED, navigates to its detail screen, and excludes it from the active monthly total", async () => {
      seedLocalStorage({
        [STORAGE_KEYS.subscriptions]: [
          makeSub({ id: "sub-1", amount: 9900, cycle: "MONTHLY" }),
          makeSub({ id: "sub-2", name: "스포티파이", amount: 5000, cycle: "MONTHLY", status: "ACTIVE" }),
        ],
      });

      renderChecklist("sub-1");

      await waitFor(() => {
        expect(screen.getByRole("button", { name: COMPLETE_BUTTON_NAME })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: COMPLETE_BUTTON_NAME }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          "/subscriptions/sub-1",
          expect.objectContaining({ state: expect.objectContaining({ subscriptionId: "sub-1" }) }),
        );
      });

      expect(getStoredSub("sub-1")?.status).toBe("CANCELED");
      expect(getStoredSub("sub-2")?.status).toBe("ACTIVE");

      const allSubs = JSON.parse(localStorage.getItem(STORAGE_KEYS.subscriptions) ?? "[]") as Subscription[];
      const activeTotal = allSubs
        .filter((s) => s.status === "ACTIVE")
        .reduce((sum, s) => sum + monthlyAmount({ amount: s.amount, cycle: s.cycle }), 0);
      expect(activeTotal).toBe(5000);
    });
  });

  // ========== AC-5 ==========
  describe("AC-5: 루트가 ScreenScaffold(screen-checklist)이고 location.state 없이 useParams의 id로 동작한다", () => {
    it("AC-5[P0]: root carries data-testid='screen-checklist'", async () => {
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [makeSub({ id: "sub-1" })] });

      renderChecklist("sub-1");

      await waitFor(() => {
        expect(screen.getByTestId("screen-checklist")).toBeInTheDocument();
      });
    });

    it("AC-5[P0]: renders without crashing when location.state is null, resolving the subscription id from the route param", async () => {
      // mockRouter()의 useLocation은 항상 { state: null }을 반환한다 — 직접 URL 접근/새로고침 재현
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [makeSub({ id: "sub-1" })] });

      renderChecklist("sub-1");

      await waitFor(() => {
        expect(screen.getAllByRole("switch")).toHaveLength(DEFAULT_CHECKLIST.length);
      });

      expect(screen.getByText("0/5 완료")).toBeInTheDocument();
    });
  });
});
