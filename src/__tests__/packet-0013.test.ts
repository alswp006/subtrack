import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { Routes, Route } from "react-router-dom";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import { STORAGE_KEYS } from "@/lib/constants";
import type { Subscription } from "@/lib/types";

mockAll();

import SubscriptionEdit from "@/pages/SubscriptionEdit";

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

// SubscriptionEdit은 useParams로 라우트 param을 읽으므로, 실제 <Route path="/subscriptions/:id/edit">
// 매칭 안에서 렌더해야 id가 주입된다 (packet-0012 SubscriptionDetail 테스트와 동일 패턴).
function renderEdit(id: string) {
  return renderWithRouter(
    React.createElement(
      Routes,
      null,
      React.createElement(Route, {
        path: "/subscriptions/:id/edit",
        element: React.createElement(SubscriptionEdit),
      }),
    ),
    { initialEntries: [`/subscriptions/${id}/edit`] },
  );
}

function getDateInput(): HTMLInputElement {
  const input = document.querySelector('input[type="date"]');
  expect(input).not.toBeNull();
  return input as HTMLInputElement;
}

function getStoredSub(id: string): Subscription | undefined {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.subscriptions) ?? "[]") as Subscription[];
  return stored.find((s) => s.id === id);
}

const SAVE_BUTTON_NAME = "변경사항 저장";

describe("구독 수정 화면 /subscriptions/:id/edit [packet-0013]", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  // ========== AC-1 ==========
  describe("AC-1: 진입 시 이름·금액·주기·첫 결제일·메모가 기존 값으로 채워져 있다", () => {
    it("AC-1[P0]: prefills every field with the existing MONTHLY subscription's values", async () => {
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [makeSub({ id: "sub-1" })] });

      renderEdit("sub-1");

      await waitFor(() => {
        expect(screen.getByDisplayValue("넷플릭스")).toBeInTheDocument();
      });

      expect(screen.getByDisplayValue("9900")).toBeInTheDocument();
      expect(screen.getByDisplayValue("가족과 함께 공유 중")).toBeInTheDocument();
      expect(getDateInput().value).toBe("2026-08-04");
      expect(screen.getByRole("tab", { name: "매월" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tab", { name: "매년" })).toHaveAttribute("aria-selected", "false");
    });

    it("AC-1[P0]: prefills the '매년' cycle tab as selected for a YEARLY subscription", async () => {
      seedLocalStorage({
        [STORAGE_KEYS.subscriptions]: [makeSub({ id: "sub-2", name: "왓챠", amount: 108000, cycle: "YEARLY" })],
      });

      renderEdit("sub-2");

      await waitFor(() => {
        expect(screen.getByDisplayValue("왓챠")).toBeInTheDocument();
      });

      expect(screen.getByDisplayValue("108000")).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "매년" })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tab", { name: "매월" })).toHaveAttribute("aria-selected", "false");
    });
  });

  // ========== AC-2 ==========
  describe("AC-2: 금액을 바꾸면 '가격 변경 메모' TextField가 나타나고, 되돌리면 사라진다", () => {
    it("AC-2[P0]: changing the amount reveals the price-change note field, and reverting to the original value hides it again", async () => {
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [makeSub({ id: "sub-1", amount: 9900 })] });

      renderEdit("sub-1");

      await waitFor(() => {
        expect(screen.getByDisplayValue("넷플릭스")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("price-note-input")).not.toBeInTheDocument();

      const amountInput = screen.getByDisplayValue("9900");
      fireEvent.change(amountInput, { target: { value: "13400" } });

      expect(screen.getByText("가격 변경 메모")).toBeInTheDocument();
      expect(screen.getByTestId("price-note-input")).toBeInTheDocument();

      fireEvent.change(amountInput, { target: { value: "9900" } });

      expect(screen.queryByText("가격 변경 메모")).not.toBeInTheDocument();
      expect(screen.queryByTestId("price-note-input")).not.toBeInTheDocument();
    });
  });

  // ========== AC-3 ==========
  describe("AC-3: 저장 시 금액 인상은 상세로 이동 + 인상 토스트, 금액 그대로면 priceHistory 불변", () => {
    it("AC-3[P0]: saving a raised amount navigates to the detail screen with a toast mentioning '3,500원 올랐어요' and appends a priceHistory entry", async () => {
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [makeSub({ id: "sub-1", amount: 9900, priceHistory: [] })] });

      renderEdit("sub-1");

      await waitFor(() => {
        expect(screen.getByDisplayValue("넷플릭스")).toBeInTheDocument();
      });

      const amountInput = screen.getByDisplayValue("9900");
      fireEvent.change(amountInput, { target: { value: "13400" } });

      const noteInput = screen.getByTestId("price-note-input");
      fireEvent.change(noteInput, { target: { value: "구독료 인상 안내" } });

      fireEvent.click(screen.getByRole("button", { name: SAVE_BUTTON_NAME }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          "/subscriptions/sub-1",
          expect.objectContaining({
            state: expect.objectContaining({ toastMessage: expect.stringContaining("3,500원 올랐어요") }),
          }),
        );
      });

      const updated = getStoredSub("sub-1");
      expect(updated?.amount).toBe(13400);
      expect(updated?.priceHistory).toHaveLength(1);
      expect(updated?.priceHistory[0].amount).toBe(13400);
      expect(updated?.priceHistory[0].note).toBe("구독료 인상 안내");
    });

    it("AC-3[P0]: saving without changing the amount leaves priceHistory length unchanged and still navigates to the detail screen", async () => {
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [makeSub({ id: "sub-1", memo: "가족과 함께 공유 중", priceHistory: [] })] });

      renderEdit("sub-1");

      await waitFor(() => {
        expect(screen.getByDisplayValue("넷플릭스")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByDisplayValue("가족과 함께 공유 중"), {
        target: { value: "이제 혼자 써요" },
      });

      fireEvent.click(screen.getByRole("button", { name: SAVE_BUTTON_NAME }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/subscriptions/sub-1", expect.anything());
      });

      const updated = getStoredSub("sub-1");
      expect(updated?.priceHistory).toHaveLength(0);
      expect(updated?.memo).toBe("이제 혼자 써요");
    });
  });

  // ========== AC-4 ==========
  describe("AC-4: 검증 실패 시 해당 필드에 에러가 표시되고 저장/이동이 일어나지 않는다", () => {
    it("AC-4[P0]: clearing the name field shows a name-field error on save and does not navigate or persist", async () => {
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [makeSub({ id: "sub-1" })] });

      renderEdit("sub-1");

      await waitFor(() => {
        expect(screen.getByDisplayValue("넷플릭스")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByDisplayValue("넷플릭스"), { target: { value: "" } });
      fireEvent.click(screen.getByRole("button", { name: SAVE_BUTTON_NAME }));

      expect(screen.getByText("이름을 입력해 주세요")).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(getStoredSub("sub-1")?.name).toBe("넷플릭스");
    });

    it("AC-4[P0]: clearing the amount field to 0 shows an amount-field error on save and does not navigate or persist", async () => {
      seedLocalStorage({ [STORAGE_KEYS.subscriptions]: [makeSub({ id: "sub-1", amount: 9900 })] });

      renderEdit("sub-1");

      await waitFor(() => {
        expect(screen.getByDisplayValue("넷플릭스")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByDisplayValue("9900"), { target: { value: "0" } });
      fireEvent.click(screen.getByRole("button", { name: SAVE_BUTTON_NAME }));

      expect(screen.getByText("금액을 입력해 주세요")).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(getStoredSub("sub-1")?.amount).toBe(9900);
    });
  });
});
