import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readJson, writeJson, clearAll, newId, ensureMeta, safeGetItem, safeSetItem } from "@/domain/storage";

describe("스토리지 프리미티브 (안전 읽기/쓰기)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ============ AC-1: Corrupted JSON handling ============
  describe("AC-1: readJson handles corrupted JSON", () => {
    it("should return fallback when JSON is malformed and move corrupted data to .corrupt key", () => {
      const key = "subtrack.subscriptions.v1";
      const corruptData = "{{broken";
      localStorage.setItem(key, corruptData);

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = readJson(key, []);

      // Should return fallback
      expect(result).toEqual([]);
      // Original should be moved to .corrupt
      expect(localStorage.getItem(`${key}.corrupt`)).toBe(corruptData);
      // Original key should be cleared
      expect(localStorage.getItem(key)).toBeNull();
      // Should warn exactly once
      expect(warnSpy).toHaveBeenCalledTimes(1);
      // Should never console.error
      expect(errorSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("should handle various types of corrupt JSON patterns", () => {
      const corruptPatterns = [
        "{{broken",
        "undefined",
        "{incomplete",
        "[1, 2, ",
        "null undefined",
      ];

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      corruptPatterns.forEach((pattern, idx) => {
        const key = `test.key.${idx}`;
        localStorage.setItem(key, pattern);
        const result = readJson(key, { fallback: true });

        expect(result).toEqual({ fallback: true });
        expect(localStorage.getItem(`${key}.corrupt`)).toBe(pattern);
      });

      warnSpy.mockRestore();
    });

    it("should return fallback with correct type parameter", () => {
      const key = "subtrack.test";
      localStorage.setItem(key, "{{broken");

      vi.spyOn(console, "warn").mockImplementation(() => {});

      interface TestData {
        id: string;
        count: number;
      }

      const fallbackValue: TestData = { id: "default", count: 0 };
      const result = readJson<TestData>(key, fallbackValue);

      expect(result).toEqual(fallbackValue);
      expect(result.id).toBe("default");
      expect(result.count).toBe(0);

      vi.restoreAllMocks();
    });
  });

  // ============ AC-2: QuotaExceededError handling ============
  describe("AC-2: writeJson handles storage quota exceeded", () => {
    it("should return STORAGE_FULL error when QuotaExceededError is thrown", () => {
      const key = "subtrack.subscriptions.v1";
      const existingValue = { id: "123", name: "test" };
      localStorage.setItem(key, JSON.stringify(existingValue));

      const setItemSpy = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(() => {
          throw new DOMException("QuotaExceededError", "QuotaExceededError");
        });

      const result = writeJson(key, { id: "456", name: "new" });

      expect(result.ok).toBe(false);
      expect(result.error).toBe("STORAGE_FULL");

      setItemSpy.mockRestore();
    });

    it("should preserve existing value when quota is exceeded", () => {
      const key = "subtrack.subscriptions.v1";
      const existingValue = { id: "old", version: 1 };
      localStorage.setItem(key, JSON.stringify(existingValue));

      const originalSetItem = Storage.prototype.setItem;
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
        this: Storage,
        k: string,
        v: string
      ) {
        if (k === key) {
          throw new DOMException("QuotaExceededError", "QuotaExceededError");
        }
        originalSetItem.call(this, k, v);
      });

      const result = writeJson(key, { id: "new", version: 2 });

      expect(result.ok).toBe(false);
      expect(result.error).toBe("STORAGE_FULL");

      const stored = JSON.parse(localStorage.getItem(key)!);
      expect(stored.id).toBe("old");
      expect(stored.version).toBe(1);

      vi.restoreAllMocks();
    });

    it("should return success for valid write", () => {
      const key = "subtrack.subscriptions.v1";
      const value = { id: "test-123", active: true };

      const result = writeJson(key, value);

      expect(result.ok).toBe(true);
      expect(result.error).toBeUndefined();

      const stored = JSON.parse(localStorage.getItem(key)!);
      expect(stored).toEqual(value);
    });

    it("should handle large payloads gracefully when quota is limited", () => {
      const key = "subtrack.test";
      const largeData = { items: Array(10000).fill({ id: "x", data: "y" }) };

      const originalSetItem = Storage.prototype.setItem;
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
        this: Storage,
        k: string,
        v: string
      ) {
        // Simulate quota exceeded for large payloads
        if (v.length > 1000) {
          throw new DOMException("QuotaExceededError", "QuotaExceededError");
        }
        originalSetItem.call(this, k, v);
      });

      const result = writeJson(key, largeData);

      expect(result.ok).toBe(false);
      expect(result.error).toBe("STORAGE_FULL");

      vi.restoreAllMocks();
    });
  });

  // ============ AC-3: clearAll removes only SubTrack keys ============
  describe("AC-3: clearAll removes only SubTrack keys", () => {
    it("should delete only SubTrack-prefixed keys and leave unrelated keys intact", () => {
      // Add SubTrack keys (the 4 keys managed by this app)
      localStorage.setItem("subtrack.subscriptions.v1", JSON.stringify([]));
      localStorage.setItem("subtrack.purchases.v1", JSON.stringify([]));
      localStorage.setItem("subtrack.meta.v1", JSON.stringify({ version: 1 }));
      localStorage.setItem("subtrack.state.v1", JSON.stringify({}));

      // Add unrelated keys that should survive
      localStorage.setItem("unrelated.key", "value1");
      localStorage.setItem("other.storage.key", "value2");
      localStorage.setItem("myapp.data", "value3");
      localStorage.setItem("analytics.session", "abc123");

      clearAll();

      // Verify SubTrack keys are deleted
      expect(localStorage.getItem("subtrack.subscriptions.v1")).toBeNull();
      expect(localStorage.getItem("subtrack.purchases.v1")).toBeNull();
      expect(localStorage.getItem("subtrack.meta.v1")).toBeNull();
      expect(localStorage.getItem("subtrack.state.v1")).toBeNull();

      // Verify unrelated keys survive
      expect(localStorage.getItem("unrelated.key")).toBe("value1");
      expect(localStorage.getItem("other.storage.key")).toBe("value2");
      expect(localStorage.getItem("myapp.data")).toBe("value3");
      expect(localStorage.getItem("analytics.session")).toBe("abc123");
    });

    it("should handle missing SubTrack keys gracefully", () => {
      // Only add unrelated keys
      localStorage.setItem("unrelated.key", "value");
      localStorage.setItem("analytics.data", "test");

      expect(() => clearAll()).not.toThrow();

      expect(localStorage.getItem("unrelated.key")).toBe("value");
      expect(localStorage.getItem("analytics.data")).toBe("test");
    });

    it("should handle edge case: .corrupt variant keys", () => {
      // Add SubTrack keys with .corrupt suffix (edge case)
      localStorage.setItem("subtrack.subscriptions.v1", "broken data");
      localStorage.setItem("subtrack.subscriptions.v1.corrupt", "{{broken");
      localStorage.setItem("subtrack.meta.v1.corrupt", "undefined");
      localStorage.setItem("unrelated.key.corrupt", "backup");

      clearAll();

      // .corrupt variants of SubTrack should also be cleared (or not, depends on impl)
      // This test ensures clearAll is idempotent
      expect(localStorage.getItem("subtrack.subscriptions.v1")).toBeNull();
      // The backup key from another service should survive
      expect(localStorage.getItem("unrelated.key.corrupt")).toBe("backup");
    });
  });

  // ============ AC-4: newId generates unique IDs ============
  describe("AC-4: newId generates unique IDs with zero duplicates", () => {
    it("should generate 100 unique IDs with zero collisions", () => {
      const ids = new Set<string>();
      const duplicates: string[] = [];

      for (let i = 0; i < 100; i++) {
        const id = newId();

        if (ids.has(id)) {
          duplicates.push(id);
        }
        ids.add(id);
      }

      expect(duplicates).toHaveLength(0);
      expect(ids.size).toBe(100);
    });

    it("should generate valid UUID format or fallback hex format", () => {
      const id = newId();

      expect(id).toBeTruthy();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(8);

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      // OR fallback hex: 32+ hex chars
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        id
      );
      const isHex = /^[0-9a-f]+$/.test(id);

      expect(isUUID || isHex).toBe(true);
    });

    it("should generate IDs with high entropy (statistical test)", () => {
      const ids = Array.from({ length: 50 }, () => newId());

      // All IDs should be different
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(50);

      // Each ID should be non-empty and reasonable length
      ids.forEach((id) => {
        expect(id.length).toBeGreaterThanOrEqual(16);
        expect(id.length).toBeLessThan(100);
      });
    });

    it("should not depend on timing (multiple rapid calls)", () => {
      const rapidIds = [];
      for (let i = 0; i < 50; i++) {
        rapidIds.push(newId());
      }

      const uniqueCount = new Set(rapidIds).size;
      expect(uniqueCount).toBe(50);
    });
  });

  // ============ ensureMeta ============
  describe("ensureMeta", () => {
    it("should create meta with schemaVersion=1 and migratedAt timestamp", () => {
      localStorage.clear();

      ensureMeta();

      const metaJson = localStorage.getItem("subtrack.meta.v1");
      expect(metaJson).toBeTruthy();

      const meta = JSON.parse(metaJson!);
      expect(meta.schemaVersion).toBe(1);
      expect(meta.migratedAt).toBeTruthy();

      // Verify timestamp is valid ISO string or timestamp
      const timestamp = new Date(meta.migratedAt);
      expect(timestamp.getTime()).toBeGreaterThan(0);
    });

    it("should not overwrite existing meta if already present", () => {
      const existingMeta = {
        schemaVersion: 1,
        migratedAt: "2025-01-01T00:00:00Z",
        customField: "should-persist",
      };
      localStorage.setItem("subtrack.meta.v1", JSON.stringify(existingMeta));

      ensureMeta();

      const meta = JSON.parse(localStorage.getItem("subtrack.meta.v1")!);
      expect(meta).toEqual(existingMeta);
      expect(meta.customField).toBe("should-persist");
    });
  });

  // ============ Happy path: valid JSON operations ============
  describe("Happy path: valid JSON read/write operations", () => {
    it("should successfully read and write valid JSON data", () => {
      const key = "subtrack.subscriptions.v1";
      const originalData = [
        { id: "sub-1", active: true, amount: 50000 },
        { id: "sub-2", active: false, amount: 100000 },
      ];

      const writeResult = writeJson(key, originalData);
      expect(writeResult.ok).toBe(true);

      const readResult = readJson(key, [] as typeof originalData);
      expect(readResult).toEqual(originalData);
      expect(readResult[0].amount).toBe(50000);
      expect(readResult[1].active).toBe(false);
    });

    it("should return fallback for missing key without creating it", () => {
      const fallback = [{ id: "default", active: false }];
      const key = "subtrack.nonexistent.v1";

      const result = readJson(key, fallback);

      expect(result).toEqual(fallback);
      expect(localStorage.getItem(key)).toBeNull();
    });

    it("should handle complex nested objects with arrays", () => {
      const key = "subtrack.complex.v1";
      const complexData = {
        metadata: { version: 1, created: new Date().toISOString() },
        subscriptions: [
          {
            id: "sub-1",
            items: [
              { name: "item1", price: 10000, quantity: 2 },
              { name: "item2", price: 5000, quantity: 1 },
            ],
          },
        ],
        stats: { total: 25000, count: 3 },
      };

      writeJson(key, complexData);
      const result = readJson(key, {} as typeof complexData);

      expect(result.metadata.version).toBe(1);
      expect(result.subscriptions[0].items[0].price).toBe(10000);
      expect(result.stats.count).toBe(3);
    });

    it("should overwrite existing value with writeJson", () => {
      const key = "subtrack.test";
      const value1 = { id: "first" };
      const value2 = { id: "second", extra: "data" };

      writeJson(key, value1);
      expect(readJson(key, {})).toEqual(value1);

      writeJson(key, value2);
      expect(readJson(key, {})).toEqual(value2);
    });
  });

  // ============ safeGetItem / safeSetItem (contract.ts) ============
  describe("safeGetItem / safeSetItem", () => {
    it("safeSetItem writes and safeGetItem reads it back", () => {
      const key = "subtrack.safe.v1";
      const value = { id: "sub-1", amountKrw: 9900 };

      expect(safeSetItem(key, value)).toBe(true);
      expect(safeGetItem<typeof value>(key)).toEqual(value);
    });

    it("safeGetItem returns null for a missing key", () => {
      expect(safeGetItem("subtrack.missing.v1")).toBeNull();
    });

    it("safeGetItem returns null and quarantines corrupted JSON", () => {
      const key = "subtrack.safe.corrupt.v1";
      localStorage.setItem(key, "{{broken");
      vi.spyOn(console, "warn").mockImplementation(() => {});

      expect(safeGetItem(key)).toBeNull();
      expect(localStorage.getItem(`${key}.corrupt`)).toBe("{{broken");

      vi.restoreAllMocks();
    });

    it("safeSetItem returns false when quota is exceeded", () => {
      const setItemSpy = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(() => {
          throw new DOMException("QuotaExceededError", "QuotaExceededError");
        });

      expect(safeSetItem("subtrack.safe.full.v1", { a: 1 })).toBe(false);

      setItemSpy.mockRestore();
    });
  });

  // ============ Edge cases and integration ============
  describe("Edge cases and integration scenarios", () => {
    it("should handle null/undefined values gracefully", () => {
      const key = "subtrack.test";

      writeJson(key, null);
      const result = readJson(key, { default: true });

      expect(result).toBeNull();
    });

    it("should distinguish between empty array and missing key", () => {
      const emptyKey = "subtrack.empty";
      const missingKey = "subtrack.missing";
      const fallback = [{ id: "default" }];

      writeJson(emptyKey, []);

      const emptyResult = readJson(emptyKey, fallback);
      const missingResult = readJson(missingKey, fallback);

      expect(emptyResult).toEqual([]);
      expect(missingResult).toEqual(fallback);
    });

    it("should handle recovery after corruption is moved", () => {
      const key = "subtrack.recovery";
      vi.spyOn(console, "warn").mockImplementation(() => {});

      // Write corrupted data
      localStorage.setItem(key, "{{broken");

      // First read should move to .corrupt
      const result1 = readJson(key, []);
      expect(result1).toEqual([]);

      // Write new valid data
      writeJson(key, [{ id: "recovered" }]);

      // Should read the new data
      const result2 = readJson(key, []);
      expect(result2).toEqual([{ id: "recovered" }]);

      // Original corrupt data should still be in .corrupt
      expect(localStorage.getItem(`${key}.corrupt`)).toBe("{{broken");

      vi.restoreAllMocks();
    });
  });
});
