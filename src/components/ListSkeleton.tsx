/**
 * 리스트 스켈레톤 — 목록 로딩 중 표시하는 고정 높이 회색 블록.
 *
 * Pre-built (재구현 금지): 목록 화면 로딩 상태에 사용. width는 항상 100%(반응형).
 */
export function ListSkeleton({ count, testId }: { count: number; testId?: string }) {
  return (
    <div
      data-testid={testId}
      role="presentation"
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          data-testid="skeleton-block"
          style={{
            width: "100%",
            height: 64,
            borderRadius: 12,
            backgroundColor: "var(--tds-color-grey50)",
          }}
        />
      ))}
    </div>
  );
}
