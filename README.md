# SubTrack

앱인토스 (Vite + React + TDS) OTT·앱 등 매달 자동결제되는 구독 서비스를 한곳에 모아 총 지출과 갱신일을 관리해주는 구독 트래커 여러 구독 서비스 결제가 흩어져 있어 총 지출 파악이 어렵고, 불필요한 구독을 해지할 타이밍을 놓치는 경우가 많다. 토스 자체 가계부는 구독 특화 관리 기능이 약하다.

## Tech Stack

- React 18.0.0
- TypeScript
- Vitest

## Routes

| Path | Description |
|------|-------------|
| `/CancelChecklist` | CancelChecklist |
| `/Checklist` | Checklist |
| `/Compare` | Compare |
| `/Home` | Home |
| `/More` | More |
| `/Premium` | Premium |
| `/SubscriptionDetail` | SubscriptionDetail |
| `/SubscriptionEdit` | SubscriptionEdit |
| `/SubscriptionNew` | SubscriptionNew |

## Getting Started

```bash
pnpm install
pnpm dev
```

## Development

```bash
pnpm typecheck    # Type checking
pnpm test         # Run tests
pnpm build        # Production build
```

## Design Documents

See `.ai-factory/` directory for full design artifacts:
- `prd.md` — Product Requirements Document
- `spec.md` — Technical Specification
- `task.md` — Epic/Task Breakdown

---
Built with [AI Factory](https://github.com/alswp006/ai-factory) · Last synced: 2026-09-03
