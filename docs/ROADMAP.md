# Roadmap

Last aligned: 2026-06-12. Phases P0–P4 of the platform-maturity plan are complete;
the project is in a **usage observation period** — daily real use decides the next
priority instead of engineering momentum.

## Done (2026-06-10 → 2026-06-12)

- P0 hardening: X login-state truthfulness, profile-busy messaging, emoji-safe
  writes (silent item loss eliminated), YouTube per-request proxy.
- Phase 1: PlatformAdapter registry for all 7 fetchable platforms, client-safe
  capability table, unified `FetchReport` + `errorCode`.
- Phase 2: card renderer registry (platform-free `ItemCard` shell), X quote
  extraction fix (0 → 212 quote cards), capability-driven source buttons,
  byte-pinned result strings.
- Phase 3: first archive migration (additive-only), `lastSeenAt`,
  `binding.authProfileId` + default-profile selection, `videoKind` merge,
  YouTube availability checking with 「源头已下架」 badge and self-healing.
- Phase 4: `npm run backup` (hot, verified) and `npm run export`
  (credentials-free archive JSON).

## Now: usage observation

Use the system daily. Record into `AI_HANDOFF.md` §5 anything that recurs:
transient refresh failures (now tagged with `errorCode`), quote/card quality
gaps, UI friction. Let pain, not plans, pick the next task.

## Next candidates (pick by observed need)

- **Phase 5 — Remote Fetch Worker** (needs a real server decision):
  stateless worker for noAuth/apiKey foreign sources (YouTube/RSS/GitHub/arXiv),
  returning `NormalizedItem[] + FetchReport`; the archive stays local-only.
  X remains local until a remote browser-profile story exists.
- Small pool (foundations already laid):
  - 3c: binding-level AuthProfile picker UI (when a second account actually exists)
  - Bilibili availability checking (needs rate-safe evidence design)
  - X diagnostics surface (FetchReport history per source) if transients annoy
  - Archive import (merge semantics design) to pair with export
  - P2 polish: empty/loading states, thumbnail resilience, deployment docs

## Later

- Phase 6 — new platforms via the adapter pattern (HuggingFace, Bluesky,
  GitHub/arXiv deepening). Weibo/Zhihu/WeChat remain out of scope for now
  (anti-scraping and compliance cost).
- Multi-device read-only access; read-later workflows; "finished reading"
  personal analytics (engagement-free).
