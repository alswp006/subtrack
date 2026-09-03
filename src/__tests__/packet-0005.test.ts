import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  listSubscriptions,
  validateSubscriptionInput,
  saveSubscription,
  updateSubscription,
  deleteSubscription,
} from "@/domain/subscriptions";

// Mock localStorage
const mockStorage = new Map<string, string>();

beforeEach(() => {
  mockStorage.clear();
  vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) =>
    mockStorage.get(key) || null
  );
  vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
    mockStorage.set(key, value);
  });
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation((key) => {
    mockStorage.delete(key);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("구독 리포지토리 (CRUD · 검증 · 가격 이력) [packet-0005]", () => {
  // ============================================================================
  // AC-1: Validation — 공백만인 name 필드
  // ============================================================================
  describe("AC-1: Validation — whitespace-only name returns error", () => {
    it("should include 'name' in validation errors for whitespace-only input", () => {
      const input = {
        name: "   ",
        amount: 5000,
        firstBillingDate: "2026-09-04",
        memo: "test",
      };
      const errors = validateSubscriptionInput(input);
      expect(errors).toContain("name");
      expect(Array.isArray(errors)).toBe(true);
    });

    it("should return {ok:false,error:'VALIDATION',fields:[...]} from saveSubscription with invalid name", () => {
      const input = {
        name: "   ",
        amount: 5000,
        firstBillingDate: "2026-09-04",
        memo: "test",
      };
      const result = saveSubscription(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("VALIDATION");
        expect(result.fields).toBeDefined();
        expect(result.fields).toContain("name");
      }
    });

    it("should reject empty name", () => {
      const errors = validateSubscriptionInput({
        name: "",
        amount: 5000,
        firstBillingDate: "2026-09-04",
        memo: "",
      });
      expect(errors).toContain("name");
    });

    it("should accept name with exactly 20 characters (after trim)", () => {
      const errors = validateSubscriptionInput({
        name: "a".repeat(20),
        amount: 5000,
        firstBillingDate: "2026-09-04",
        memo: "",
      });
      expect(errors).not.toContain("name");
    });

    it("should reject name longer than 20 characters (after trim)", () => {
      const errors = validateSubscriptionInput({
        name: "a".repeat(21),
        amount: 5000,
        firstBillingDate: "2026-09-04",
        memo: "",
      });
      expect(errors).toContain("name");
    });

    it("should trim whitespace from name before validation", () => {
      const errors = validateSubscriptionInput({
        name: "  Netflix  ",
        amount: 13500,
        firstBillingDate: "2026-09-04",
        memo: "",
      });
      expect(errors).not.toContain("name");
    });
  });

  // ============================================================================
  // AC-2: MAX_ITEMS — 100건 리미트
  // ============================================================================
  describe("AC-2: MAX_ITEMS limit — 100 subscriptions cap", () => {
    it("should return {ok:false,error:'MAX_ITEMS'} when saving 101st subscription", () => {
      // Pre-populate storage with 100 subscriptions
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: `sub-${i}`,
        name: `Subscription ${i}`,
        amount: 5000 + i,
        firstBillingDate: "2026-09-04",
        nextBillingDate: "2026-10-04",
        memo: "",
        priceHistory: [],
        createdAt: "2026-09-04T00:00:00Z",
      }));
      mockStorage.set("subtrack.subscriptions.v1", JSON.stringify(items));

      const newSub = {
        name: "Over Limit",
        amount: 10000,
        firstBillingDate: "2026-09-04",
        memo: "",
      };
      const result = saveSubscription(newSub);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("MAX_ITEMS");
      }
    });

    it("should maintain exactly 100 subscriptions after MAX_ITEMS rejection", () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: `sub-${i}`,
        name: `Sub ${i}`,
        amount: 5000 + i,
        firstBillingDate: "2026-09-04",
        nextBillingDate: "2026-10-04",
        memo: "",
        priceHistory: [],
        createdAt: "2026-09-04T00:00:00Z",
      }));
      mockStorage.set("subtrack.subscriptions.v1", JSON.stringify(items));

      saveSubscription({
        name: "Over Limit",
        amount: 10000,
        firstBillingDate: "2026-09-04",
        memo: "",
      });

      const stored = listSubscriptions();
      expect(stored).toHaveLength(100);
    });

    it("should accept 99th and 100th subscription but reject 101st", () => {
      const items = Array.from({ length: 99 }, (_, i) => ({
        id: `sub-${i}`,
        name: `Sub ${i}`,
        amount: 5000 + i,
        firstBillingDate: "2026-09-04",
        nextBillingDate: "2026-10-04",
        memo: "",
        priceHistory: [],
        createdAt: "2026-09-04T00:00:00Z",
      }));
      mockStorage.set("subtrack.subscriptions.v1", JSON.stringify(items));

      // 100th should succeed
      const result100 = saveSubscription({
        name: "Sub 100",
        amount: 5100,
        firstBillingDate: "2026-09-04",
        memo: "",
      });
      expect(result100.ok).toBe(true);

      // 101st should fail
      const result101 = saveSubscription({
        name: "Sub 101",
        amount: 5101,
        firstBillingDate: "2026-09-04",
        memo: "",
      });
      expect(result101.ok).toBe(false);
    });
  });

  // ============================================================================
  // AC-3: Price History — 금액 변동 추적 & delta 계산
  // ============================================================================
  describe("AC-3: Price history — track changes, ignore same amount", () => {
    it("should add to priceHistory when amount changes (13500→17000) with delta=3500", () => {
      const sub = {
        id: "sub-netflix",
        name: "Netflix",
        amount: 13500,
        firstBillingDate: "2026-09-04",
        nextBillingDate: "2026-10-04",
        memo: "",
        priceHistory: [],
        createdAt: "2026-09-04T00:00:00Z",
      };
      mockStorage.set("subtrack.subscriptions.v1", JSON.stringify([sub]));

      const result = updateSubscription("sub-netflix", { amount: 17000 });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.delta).toBe(3500);
        const updated = listSubscriptions().find((s) => s.id === "sub-netflix");
        expect(updated).toBeDefined();
        expect(updated?.priceHistory).toHaveLength(1);
        expect(updated?.priceHistory[0].oldAmount).toBe(13500);
        expect(updated?.priceHistory[0].newAmount).toBe(17000);
      }
    });

    it("should not add to priceHistory when amount is unchanged (delta=0)", () => {
      const sub = {
        id: "sub-netflix",
        name: "Netflix",
        amount: 13500,
        firstBillingDate: "2026-09-04",
        nextBillingDate: "2026-10-04",
        memo: "",
        priceHistory: [
          {
            oldAmount: 12000,
            newAmount: 13500,
            changedAt: "2026-08-04T00:00:00Z",
          },
        ],
        createdAt: "2026-09-04T00:00:00Z",
      };
      mockStorage.set("subtrack.subscriptions.v1", JSON.stringify([sub]));

      const result = updateSubscription("sub-netflix", { amount: 13500 });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.delta).toBe(0);
        const updated = listSubscriptions().find((s) => s.id === "sub-netflix");
        expect(updated?.priceHistory).toHaveLength(1);
      }
    });

    it("should record both increase and decrease in price history", () => {
      const sub = {
        id: "sub-test",
        name: "Test",
        amount: 10000,
        firstBillingDate: "2026-09-04",
        nextBillingDate: "2026-10-04",
        memo: "",
        priceHistory: [],
        createdAt: "2026-09-04T00:00:00Z",
      };
      mockStorage.set("subtrack.subscriptions.v1", JSON.stringify([sub]));

      // Increase: 10000 → 12000
      updateSubscription("sub-test", { amount: 12000 });

      // Decrease: 12000 → 9000
      const result2 = updateSubscription("sub-test", { amount: 9000 });

      expect(result2.ok).toBe(true);
      if (result2.ok) {
        expect(result2.delta).toBe(-3000);
        const updated = listSubscriptions().find((s) => s.id === "sub-test");
        expect(updated?.priceHistory).toHaveLength(2);
        expect(updated?.priceHistory[0].newAmount).toBe(12000);
        expect(updated?.priceHistory[1].newAmount).toBe(9000);
      }
    });
  });

  // ============================================================================
  // AC-4: Price History Limit — 20건 최대, FIFO 제거
  // ============================================================================
  describe("AC-4: Price history limit — max 20 items, remove oldest", () => {
    it("should maintain exactly 20 items in priceHistory after exceeding limit", () => {
      const priceHistory = Array.from({ length: 20 }, (_, i) => ({
        oldAmount: 5000 + i * 100,
        newAmount: 5100 + i * 100,
        changedAt: new Date(2026, 0, i + 1).toISOString(),
      }));

      const sub = {
        id: "sub-test",
        name: "Test",
        amount: 15000,
        firstBillingDate: "2026-09-04",
        nextBillingDate: "2026-10-04",
        memo: "",
        priceHistory,
        createdAt: "2026-09-04T00:00:00Z",
      };
      mockStorage.set("subtrack.subscriptions.v1", JSON.stringify([sub]));

      // Update amount to add 21st item
      updateSubscription("sub-test", { amount: 15500 });

      const updated = listSubscriptions().find((s) => s.id === "sub-test");
      expect(updated?.priceHistory).toHaveLength(20);
    });

    it("should remove oldest item when priceHistory exceeds 20", () => {
      const priceHistory = Array.from({ length: 20 }, (_, i) => ({
        oldAmount: 5000 + i * 100,
        newAmount: 5100 + i * 100,
        changedAt: new Date(2026, 0, i + 1).toISOString(),
      }));

      const sub = {
        id: "sub-test",
        name: "Test",
        amount: 15000,
        firstBillingDate: "2026-09-04",
        nextBillingDate: "2026-10-04",
        memo: "",
        priceHistory,
        createdAt: "2026-09-04T00:00:00Z",
      };
      mockStorage.set("subtrack.subscriptions.v1", JSON.stringify([sub]));

      // Oldest item: oldAmount = 5000, newAmount = 5100
      updateSubscription("sub-test", { amount: 15500 });

      const updated = listSubscriptions().find((s) => s.id === "sub-test");
      expect(updated?.priceHistory[0].oldAmount).toBe(5100);
      expect(updated?.priceHistory[19].newAmount).toBe(15500);
    });
  });

  // ============================================================================
  // Validation Rules (comprehensive)
  // ============================================================================
  describe("Validation Rules — comprehensive", () => {
    it("should reject amount < 1", () => {
      const errors = validateSubscriptionInput({
        name: "Netflix",
        amount: 0,
        firstBillingDate: "2026-09-04",
        memo: "",
      });
      expect(errors).toContain("amount");
    });

    it("should reject amount > 10,000,000", () => {
      const errors = validateSubscriptionInput({
        name: "Netflix",
        amount: 10000001,
        firstBillingDate: "2026-09-04",
        memo: "",
      });
      expect(errors).toContain("amount");
    });

    it("should reject non-integer amount", () => {
      const errors = validateSubscriptionInput({
        name: "Netflix",
        amount: 5000.5,
        firstBillingDate: "2026-09-04",
        memo: "",
      });
      expect(errors).toContain("amount");
    });

    it("should accept amount with exactly 1 and 10,000,000", () => {
      const errors1 = validateSubscriptionInput({
        name: "Netflix",
        amount: 1,
        firstBillingDate: "2026-09-04",
        memo: "",
      });
      const errors2 = validateSubscriptionInput({
        name: "Netflix",
        amount: 10000000,
        firstBillingDate: "2026-09-04",
        memo: "",
      });
      expect(errors1).not.toContain("amount");
      expect(errors2).not.toContain("amount");
    });

    it("should reject invalid date format", () => {
      const errors = validateSubscriptionInput({
        name: "Netflix",
        amount: 5000,
        firstBillingDate: "2026-13-01",
        memo: "",
      });
      expect(errors).toContain("firstBillingDate");
    });

    it("should reject past date (before today)", () => {
      const errors = validateSubscriptionInput({
        name: "Netflix",
        amount: 5000,
        firstBillingDate: "2020-01-01",
        memo: "",
      });
      expect(errors).toContain("firstBillingDate");
    });

    it("should reject memo longer than 100 characters", () => {
      const errors = validateSubscriptionInput({
        name: "Netflix",
        amount: 5000,
        firstBillingDate: "2026-09-04",
        memo: "a".repeat(101),
      });
      expect(errors).toContain("memo");
    });

    it("should accept memo with exactly 100 characters", () => {
      const errors = validateSubscriptionInput({
        name: "Netflix",
        amount: 5000,
        firstBillingDate: "2026-09-04",
        memo: "a".repeat(100),
      });
      expect(errors).not.toContain("memo");
    });

    it("should accept valid input with all constraints met", () => {
      const errors = validateSubscriptionInput({
        name: "Netflix",
        amount: 13500,
        firstBillingDate: "2026-09-04",
        memo: "Monthly subscription",
      });
      expect(errors).toHaveLength(0);
    });

    it("should return multiple field names when multiple validations fail", () => {
      const errors = validateSubscriptionInput({
        name: "   ",
        amount: 0,
        firstBillingDate: "invalid",
        memo: "a".repeat(101),
      });
      expect(errors.length).toBeGreaterThanOrEqual(2);
      expect(errors).toContain("name");
      expect(errors).toContain("amount");
    });
  });

  // ============================================================================
  // CRUD Operations
  // ============================================================================
  describe("CRUD Operations", () => {
    it("should save new subscription with generated id and calculated nextBillingDate", () => {
      const result = saveSubscription({
        name: "Netflix",
        amount: 13500,
        firstBillingDate: "2026-09-04",
        memo: "Monthly",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const saved = result.data;
        expect(saved.id).toBeDefined();
        expect(typeof saved.id).toBe("string");
        expect(saved.name).toBe("Netflix");
        expect(saved.amount).toBe(13500);
        expect(saved.nextBillingDate).toBeDefined();
        expect(saved.createdAt).toBeDefined();
        expect(saved.priceHistory).toHaveLength(0);
      }
    });

    it("should return correct structure on successful save", () => {
      const result = saveSubscription({
        name: "Spotify",
        amount: 10900,
        firstBillingDate: "2026-09-04",
        memo: "",
      });

      expect(result).toHaveProperty("ok");
      expect(result).toHaveProperty("data");
      if (result.ok) {
        expect(result.data).toHaveProperty("id");
        expect(result.data).toHaveProperty("name");
        expect(result.data).toHaveProperty("amount");
        expect(result.data).toHaveProperty("firstBillingDate");
        expect(result.data).toHaveProperty("nextBillingDate");
        expect(result.data).toHaveProperty("memo");
        expect(result.data).toHaveProperty("priceHistory");
        expect(result.data).toHaveProperty("createdAt");
      }
    });

    it("should list all subscriptions in order", () => {
      saveSubscription({
        name: "Netflix",
        amount: 13500,
        firstBillingDate: "2026-09-04",
        memo: "",
      });
      saveSubscription({
        name: "Spotify",
        amount: 10900,
        firstBillingDate: "2026-09-04",
        memo: "",
      });

      const subs = listSubscriptions();
      expect(subs).toHaveLength(2);
      expect(subs[0].name).toBe("Netflix");
      expect(subs[1].name).toBe("Spotify");
    });

    it("should delete subscription by id", () => {
      const result1 = saveSubscription({
        name: "Netflix",
        amount: 13500,
        firstBillingDate: "2026-09-04",
        memo: "",
      });

      expect(result1.ok).toBe(true);
      if (result1.ok) {
        const id = result1.data.id;
        expect(listSubscriptions()).toHaveLength(1);

        deleteSubscription(id);

        expect(listSubscriptions()).toHaveLength(0);
      }
    });

    it("should not throw when deleting non-existent id", () => {
      expect(() => deleteSubscription("non-existent")).not.toThrow();
    });

    it("should update subscription fields (name, memo, etc)", () => {
      const result1 = saveSubscription({
        name: "Netflix",
        amount: 13500,
        firstBillingDate: "2026-09-04",
        memo: "Old memo",
      });

      expect(result1.ok).toBe(true);
      if (result1.ok) {
        const id = result1.data.id;
        const result2 = updateSubscription(id, {
          name: "Netflix Premium",
          memo: "New memo",
        });

        expect(result2.ok).toBe(true);
        if (result2.ok) {
          const updated = listSubscriptions().find((s) => s.id === id);
          expect(updated?.name).toBe("Netflix Premium");
          expect(updated?.memo).toBe("New memo");
        }
      }
    });
  });
});
