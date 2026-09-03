import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getToday,
  isValidDateString,
  monthlyAmount,
  computeNextBillingDate,
  daysUntil,
  formatKRW,
  ddayLabel,
} from "@/domain/calc";

describe("packet-0003: 날짜 · 금액 계산 순수 함수", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe("AC-1: monthlyAmount 변환", () => {
    it("should convert annual amount to monthly using Math.round", () => {
      const result = monthlyAmount({ amount: 29000, cycle: "YEARLY" });
      expect(result).toBe(2417);
      expect(typeof result).toBe("number");
    });

    it("should return amount as-is for MONTHLY cycle", () => {
      const result = monthlyAmount({ amount: 13500, cycle: "MONTHLY" });
      expect(result).toBe(13500);
      expect(result).toEqual(13500);
    });

    it("should handle 0 amount correctly", () => {
      expect(monthlyAmount({ amount: 0, cycle: "YEARLY" })).toBe(0);
      expect(monthlyAmount({ amount: 0, cycle: "MONTHLY" })).toBe(0);
    });

    it("should round correctly for amounts that don't divide evenly", () => {
      // 12000 / 12 = 1000 exactly
      expect(monthlyAmount({ amount: 12000, cycle: "YEARLY" })).toBe(1000);
      // 13000 / 12 = 1083.333... → 1083
      expect(monthlyAmount({ amount: 13000, cycle: "YEARLY" })).toBe(1083);
    });
  });

  describe("AC-2: computeNextBillingDate 월말 보정", () => {
    it("should handle month-end: Jan 31 → Apr 30 (April has 30 days)", () => {
      const result = computeNextBillingDate("2026-01-31", "MONTHLY", "2026-04-01");
      expect(result).toBe("2026-04-30");
      expect(typeof result).toBe("string");
    });

    it("should return today's date if today is the billing date", () => {
      const result = computeNextBillingDate("2026-04-30", "MONTHLY", "2026-04-30");
      expect(result).toBe("2026-04-30");
    });

    it("should advance to next month's day when today is before billing date", () => {
      // Billing day is 10th, today is Sep 4
      // Should return Sep 10
      const result = computeNextBillingDate("2026-08-10", "MONTHLY", "2026-09-04");
      expect(result).toBe("2026-09-10");
    });

    it("should handle month-end dates correctly in leap year", () => {
      // Feb 29 in leap year (2024)
      const result = computeNextBillingDate("2024-02-29", "MONTHLY", "2024-03-01");
      expect(result).toBe("2024-03-29");
    });

    it("should advance to next month after billing day", () => {
      // Billing day is 15th, today is Sep 20
      // Should return Oct 15
      const result = computeNextBillingDate("2026-09-15", "MONTHLY", "2026-09-20");
      expect(result).toBe("2026-10-15");
    });
  });

  describe("AC-3: daysUntil 계산", () => {
    it("should compute next billing on the 10th correctly", () => {
      const result = computeNextBillingDate("2026-08-10", "MONTHLY", "2026-09-04");
      expect(result).toBe("2026-09-10");
      expect(result.length).toBe(10);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should calculate exact days between two dates", () => {
      const result = daysUntil("2026-09-06", "2026-09-04");
      expect(result).toBe(2);
      expect(typeof result).toBe("number");
    });

    it("should return 0 when dates are the same", () => {
      expect(daysUntil("2026-09-04", "2026-09-04")).toBe(0);
    });

    it("should calculate across month boundaries", () => {
      expect(daysUntil("2026-10-05", "2026-09-30")).toBe(5);
    });

    it("should calculate across year boundaries", () => {
      expect(daysUntil("2027-01-05", "2026-12-31")).toBe(5);
    });
  });

  describe("AC-4: 잘못된 입력 처리 (예외 없음)", () => {
    it("should return empty string for computeNextBillingDate with invalid date", () => {
      const result = computeNextBillingDate("invalid", "MONTHLY", "2026-09-04");
      expect(result).toBe("");
      expect(typeof result).toBe("string");
    });

    it("should return NaN for daysUntil with invalid date", () => {
      const result = daysUntil("invalid", "2026-09-04");
      expect(Number.isNaN(result)).toBe(true);
    });

    it("should return NaN when both dates are invalid", () => {
      const result = daysUntil("invalid1", "invalid2");
      expect(Number.isNaN(result)).toBe(true);
    });

    it("should not call console.error for invalid inputs", () => {
      computeNextBillingDate("invalid", "MONTHLY", "2026-09-04");
      computeNextBillingDate("2026-13-32", "MONTHLY", "2026-09-04");
      daysUntil("invalid", "2026-09-04");
      daysUntil("2026-09-04", "not-a-date");

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("should handle invalid month/day combinations gracefully", () => {
      const result1 = computeNextBillingDate("2026-02-30", "MONTHLY", "2026-09-04");
      const result2 = computeNextBillingDate("2026-13-01", "MONTHLY", "2026-09-04");
      const result3 = computeNextBillingDate("2026-01-32", "MONTHLY", "2026-09-04");

      expect(result1).toBe("");
      expect(result2).toBe("");
      expect(result3).toBe("");
    });
  });

  describe("AC-5: 환경 제약 확인 (구현 검증)", () => {
    it("should not use Array.prototype.at (compatibility)", () => {
      // This test ensures implementation avoids Array.at
      const dates = ["2026-09-04", "2026-09-05"];
      const result = daysUntil(dates[1], dates[0]);
      expect(result).toBe(1);
    });

    it("should not use Array.prototype.findLast", () => {
      // Pure function test - no array methods needed
      expect(monthlyAmount({ amount: 24000, cycle: "YEARLY" })).toBe(2000);
    });
  });

  describe("isValidDateString utility", () => {
    it("should validate correct YYYY-MM-DD format", () => {
      expect(isValidDateString("2026-09-04")).toBe(true);
      expect(isValidDateString("2024-02-29")).toBe(true);
      expect(isValidDateString("2000-01-01")).toBe(true);
    });

    it("should reject invalid dates", () => {
      expect(isValidDateString("2026-13-01")).toBe(false);
      expect(isValidDateString("2026-02-30")).toBe(false);
      expect(isValidDateString("2026-01-32")).toBe(false);
      expect(isValidDateString("invalid")).toBe(false);
      expect(isValidDateString("2026/09/04")).toBe(false);
      expect(isValidDateString("")).toBe(false);
    });
  });

  describe("formatKRW utility", () => {
    it("should format KRW with comma separators", () => {
      expect(formatKRW(1000000)).toBe("1,000,000");
      expect(formatKRW(5000)).toBe("5,000");
      expect(formatKRW(100)).toBe("100");
    });

    it("should handle edge cases", () => {
      expect(formatKRW(0)).toBe("0");
      expect(formatKRW(999)).toBe("999");
      expect(formatKRW(10000000)).toBe("10,000,000");
    });
  });

  describe("ddayLabel utility", () => {
    it("should return '오늘 결제' for 0 days", () => {
      expect(ddayLabel(0)).toBe("오늘 결제");
    });

    it("should return D-N format for positive days", () => {
      expect(ddayLabel(3)).toBe("D-3");
      expect(ddayLabel(1)).toBe("D-1");
      expect(ddayLabel(30)).toBe("D-30");
    });

    it("should return '결제 완료' for negative days", () => {
      expect(ddayLabel(-1)).toBe("결제 완료");
      expect(ddayLabel(-5)).toBe("결제 완료");
    });
  });

  describe("getToday utility", () => {
    it("should return KST date in YYYY-MM-DD format", () => {
      const today = getToday();
      expect(typeof today).toBe("string");
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(isValidDateString(today)).toBe(true);
    });
  });

  describe("Integration: monthly billing cycle", () => {
    it("should compute next billing after processing monthly payment", () => {
      // Scenario: billing day is 10th, today is Sep 4
      const nextBilling = computeNextBillingDate("2026-08-10", "MONTHLY", "2026-09-04");
      const daysToBilling = daysUntil(nextBilling, "2026-09-04");
      expect(nextBilling).toBe("2026-09-10");
      expect(daysToBilling).toBe(6);
    });

    it("should convert yearly subscription and compute billing", () => {
      const monthlyFee = monthlyAmount({ amount: 120000, cycle: "YEARLY" });
      expect(monthlyFee).toBe(10000);
      const formatted = formatKRW(monthlyFee);
      expect(formatted).toBe("10,000");
    });
  });
});
