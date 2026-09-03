import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SERVICE_TEMPLATES,
  DEFAULT_CHECKLIST,
  STORAGE_KEYS,
  getBenchmark,
  DEFAULT_BENCHMARK,
  BENCHMARK_DISCLAIMER,
  MAX_SUBSCRIPTIONS,
  FREE_SUBSCRIPTION_LIMIT,
  MAX_PRICE_HISTORY,
  COMPARE_UNLOCK_HOURS,
  MAX_STORAGE_CHARS,
} from "@/lib/constants";

describe("정적 상수 · 스토리지 키 정의 [packet-0002]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ========== AC-1: SERVICE_TEMPLATES ==========
  describe("AC-1: SERVICE_TEMPLATES structure and content", () => {
    it("AC-1[P0]: should have exactly 12 service templates", () => {
      expect(SERVICE_TEMPLATES).toHaveLength(12);
    });

    it("AC-1[P0]: should have no duplicate keys", () => {
      const keys = SERVICE_TEMPLATES.map((t) => t.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(12);
      expect(keys.length).toBe(12);
    });

    it("AC-1[P0]: should contain Netflix with OTT category", () => {
      const netflix = SERVICE_TEMPLATES.find((t) => t.name === "넷플릭스");
      expect(netflix).toBeDefined();
      expect(netflix?.name).toBe("넷플릭스");
      expect(netflix?.category).toBe("OTT");
      expect(netflix?.key).toBeDefined();
      expect(netflix?.key).toBeTruthy();
      expect(netflix?.iconKey).toBeDefined();
      expect(netflix?.iconKey).toBeTruthy();
    });

    it("AC-1[P0]: each template should have required properties", () => {
      SERVICE_TEMPLATES.forEach((template) => {
        expect(template.key).toBeDefined();
        expect(typeof template.key).toBe("string");
        expect(template.name).toBeDefined();
        expect(typeof template.name).toBe("string");
        expect(template.category).toBeDefined();
        expect(template.iconKey).toBeDefined();
        expect(typeof template.iconKey).toBe("string");
      });
    });
  });

  // ========== AC-2: DEFAULT_CHECKLIST ==========
  describe("AC-2: DEFAULT_CHECKLIST structure and labels", () => {
    it("AC-2[P0]: should have exactly 5 checklist items", () => {
      expect(DEFAULT_CHECKLIST).toHaveLength(5);
    });

    it("AC-2[P0]: should have ids exactly matching required set", () => {
      const ids = new Set(DEFAULT_CHECKLIST.map((item) => item.id));
      const expectedIds = new Set([
        "remaining",
        "autopay",
        "backup",
        "notify",
        "capture",
      ]);
      expect(ids).toEqual(expectedIds);
      expect(ids.size).toBe(5);
    });

    it("AC-2[P0]: should not contain forbidden strings in labels", () => {
      const forbiddenStrings = ["설치", "다운로드", "바로가기"];
      DEFAULT_CHECKLIST.forEach((item) => {
        forbiddenStrings.forEach((str) => {
          expect(item.label).not.toContain(str);
        });
      });
    });

    it("AC-2[P0]: each checklist item should have id and label", () => {
      DEFAULT_CHECKLIST.forEach((item) => {
        expect(item.id).toBeDefined();
        expect(typeof item.id).toBe("string");
        expect(item.label).toBeDefined();
        expect(typeof item.label).toBe("string");
        expect(item.label.length).toBeGreaterThan(0);
      });
    });
  });

  // ========== AC-3: getBenchmark error handling ==========
  describe("AC-3: getBenchmark error handling with broken JSON", () => {
    it("AC-3[P0]: should handle malformed JSON gracefully", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = getBenchmark("{{broken");

      expect(result).toEqual(DEFAULT_BENCHMARK);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("AC-3[P0]: should not throw exception on broken JSON", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      expect(() => {
        getBenchmark("{{broken");
      }).not.toThrow();

      warnSpy.mockRestore();
    });

    it("AC-3[P0]: should warn message when JSON parse fails", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      getBenchmark("invalid json");

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toMatch(/benchmark|json|parse/i);

      warnSpy.mockRestore();
    });
  });

  // ========== AC-4: No hardcoded HEX colors ==========
  describe("AC-4: No hardcoded HEX color values", () => {
    it("AC-4[P0]: storage key values should not contain HEX colors", () => {
      const hexPattern = /#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?(?!\w)/;
      Object.values(STORAGE_KEYS).forEach((value) => {
        expect(value).not.toMatch(hexPattern);
      });
    });

    it("AC-4[P0]: BENCHMARK_DISCLAIMER should not contain HEX colors", () => {
      const hexPattern = /#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?(?!\w)/;
      expect(BENCHMARK_DISCLAIMER).not.toMatch(hexPattern);
    });

    it("AC-4[P0]: numeric constants should be numbers (not HEX strings)", () => {
      expect(typeof MAX_SUBSCRIPTIONS).toBe("number");
      expect(typeof FREE_SUBSCRIPTION_LIMIT).toBe("number");
      expect(typeof MAX_PRICE_HISTORY).toBe("number");
      expect(typeof COMPARE_UNLOCK_HOURS).toBe("number");
      expect(typeof MAX_STORAGE_CHARS).toBe("number");
    });
  });

  // ========== Additional validations ==========
  describe("STORAGE_KEYS structure", () => {
    it("should have exactly 4 storage keys", () => {
      const keys = Object.keys(STORAGE_KEYS);
      expect(keys).toHaveLength(4);
      expect(keys).toContain("subscriptions");
      expect(keys).toContain("checklists");
      expect(keys).toContain("settings");
      expect(keys).toContain("meta");
    });

    it("should have correct storage key values", () => {
      expect(STORAGE_KEYS.subscriptions).toBe("subtrack.subscriptions.v1");
      expect(STORAGE_KEYS.checklists).toBe("subtrack.checklists.v1");
      expect(STORAGE_KEYS.settings).toBe("subtrack.settings.v1");
      expect(STORAGE_KEYS.meta).toBe("subtrack.meta.v1");
    });

    it("should have all keys as strings starting with subtrack.", () => {
      Object.values(STORAGE_KEYS).forEach((value) => {
        expect(typeof value).toBe("string");
        expect(value).toMatch(/^subtrack\./);
      });
    });
  });

  describe("Numeric constants", () => {
    it("should have correct numeric constant values", () => {
      expect(MAX_SUBSCRIPTIONS).toBe(100);
      expect(FREE_SUBSCRIPTION_LIMIT).toBe(3);
      expect(MAX_PRICE_HISTORY).toBe(20);
      expect(COMPARE_UNLOCK_HOURS).toBe(24);
      expect(MAX_STORAGE_CHARS).toBe(1048576);
    });

    it("should have positive numeric constants", () => {
      expect(MAX_SUBSCRIPTIONS).toBeGreaterThan(0);
      expect(FREE_SUBSCRIPTION_LIMIT).toBeGreaterThan(0);
      expect(MAX_PRICE_HISTORY).toBeGreaterThan(0);
      expect(COMPARE_UNLOCK_HOURS).toBeGreaterThan(0);
      expect(MAX_STORAGE_CHARS).toBeGreaterThan(0);
    });

    it("should have reasonable ordering: FREE_SUBSCRIPTION_LIMIT < MAX_SUBSCRIPTIONS", () => {
      expect(FREE_SUBSCRIPTION_LIMIT).toBeLessThan(MAX_SUBSCRIPTIONS);
    });
  });

  describe("BENCHMARK_DISCLAIMER", () => {
    it("should be a non-empty string", () => {
      expect(typeof BENCHMARK_DISCLAIMER).toBe("string");
      expect(BENCHMARK_DISCLAIMER.length).toBeGreaterThan(0);
    });

    it("should not contain HEX color patterns", () => {
      const hexPattern = /#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?(?!\w)/;
      expect(BENCHMARK_DISCLAIMER).not.toMatch(hexPattern);
    });
  });

  describe("DEFAULT_BENCHMARK", () => {
    it("should be a defined object", () => {
      expect(DEFAULT_BENCHMARK).toBeDefined();
      expect(typeof DEFAULT_BENCHMARK).toBe("object");
    });

    it("should have benchmark data for multiple age bands", () => {
      // BenchmarkTable는 AgeBand (20-24, 25-29, 30-34, 35-39)의 숫자 매핑
      expect(DEFAULT_BENCHMARK).toHaveProperty("20-24");
      expect(DEFAULT_BENCHMARK).toHaveProperty("25-29");
      expect(DEFAULT_BENCHMARK).toHaveProperty("30-34");
      expect(DEFAULT_BENCHMARK).toHaveProperty("35-39");
    });

    it("should have numeric values in benchmark data", () => {
      Object.values(DEFAULT_BENCHMARK).forEach((value) => {
        expect(typeof value).toBe("number");
        expect(value).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe("getBenchmark function", () => {
    it("should return DEFAULT_BENCHMARK with valid JSON", () => {
      const validJson = JSON.stringify({
        "20-24": 50000,
        "25-29": 60000,
        "30-34": 70000,
        "35-39": 80000,
      });

      const result = getBenchmark(validJson);

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
      expect(result["20-24"]).toBe(50000);
    });

    it("should return DEFAULT_BENCHMARK with empty string", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = getBenchmark("");

      expect(result).toEqual(DEFAULT_BENCHMARK);

      warnSpy.mockRestore();
    });
  });
});
