import { Paragraph, Spacing } from "@toss/tds-mobile";

/**
 * 미니 바 차트 — 카테고리 비중 상위 5개를 가로 막대로.
 *
 * Pre-built (재구현 금지): 카드/행에 정보 밀도를 더할 때. width는 항상 100%(반응형).
 */
export function MiniBar({
  items,
  testId,
}: {
  items: { category: string; percent: number }[];
  testId?: string;
}) {
  if (!items || items.length === 0) {
    return (
      <Paragraph.Text typography="st12" color="var(--tds-color-grey500)">
        데이터가 아직 없어요
      </Paragraph.Text>
    );
  }

  const top5 = [...items].sort((a, b) => b.percent - a.percent).slice(0, 5);

  return (
    <div data-testid={testId} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {top5.map((item) => (
        <div key={item.category} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Paragraph.Text typography="st13">{item.category}</Paragraph.Text>
            <Paragraph.Text typography="st13">{item.percent}%</Paragraph.Text>
          </div>
          <Spacing size={2} />
          <div
            style={{
              width: "100%",
              height: 8,
              borderRadius: 4,
              backgroundColor: "var(--tds-color-grey100)",
              overflow: "hidden",
            }}
          >
            <div
              role="progressbar"
              aria-valuenow={Math.round(item.percent)}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{
                width: `${Math.max(0, Math.min(100, item.percent))}%`,
                height: "100%",
                borderRadius: 4,
                backgroundColor: "var(--tds-color-blue400)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
