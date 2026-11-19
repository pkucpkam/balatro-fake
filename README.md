# Balatro Fake

Game roguelike deck-builder lấy cảm hứng từ Balatro — React + TypeScript, chạy hoàn toàn phía client.
Gameplay tái tạo cơ chế; code, artwork và âm thanh tự làm.

## Chạy

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest
npm run typecheck
npm run build
```

## Trạng thái: Phase 1 + Phase 2 xong

| Phase | Nội dung | Trạng thái |
| --- | --- | --- |
| 1. Foundation | Vite/React/TS, Card model, Deck, Seeded RNG, replay | ✅ |
| 2. Poker Engine | 12 Poker Hands, Scoring Card Resolver, Hand Level, Planet | ✅ |
| 3. Scoring & Effects | Scoring Pipeline, Effect/Trigger, Joker, Retrigger | ⏳ tiếp theo |
| 4. Gameplay Loop | Blind Manager, Boss, Shop, Economy, Tag | — |
| 5. Visual & Animation | Framer Motion, GSAP, shaders, audio | — |
| 6. Content Expansion | Tarot, Spectral, Voucher, Deck, Pack | — |
| 7. Polish | Save/Load IndexedDB, Settings, profiling | — |

UI hiện tại chỉ là màn debug để chơi thử engine (chọn bài, Play/Discard, Sort, event log).
Sau khi thắng blind có nút dùng Planet (debug) và Next Blind; Shop sẽ thay thế ở Phase 4.

## Kiến trúc

```
src/
├── engine/                 # Pure TypeScript, KHÔNG import React
│   ├── core/               # GameState, GameAction, GameEvent, GameReducer, GameEngine
│   ├── cards/              # PlayingCard, Rank/Suit, chip values
│   ├── deck/               # Zones: drawPile / hand / played / discardPile
│   ├── poker/              # HandRank, HandEvaluator, HandLevels, HandScorer
│   ├── blind/              # BlindTable (tạm, Phase 4 thay bằng Blind Manager)
│   └── rng/                # SeededRng (cyrb128 + sfc32), state serialisable
├── content/planets/        # Dữ liệu Planet (registry)
├── features/game/          # gameStore (Zustand) + GameScreen
└── styles/
tests/                      # rng, deck, poker evaluator, scoring, engine/replay/simulation
```

### Các nguyên tắc đã hiện thực

- **Reducer thuần**: `reduce(state, action) → { state, events }`. Không mutate input (Immer), action không hợp lệ ném `InvalidActionError` và state giữ nguyên.
- **Deterministic**: mọi random đi qua `state.rng` (4×uint32). Cùng seed + cùng danh sách action → state giống hệt. `GameEngine.replay(actionLog)` dựng lại run.
- **Save = `JSON.stringify(state)`**: đã test round-trip và tiếp tục chơi giống hệt.
- **Engine tính ngay, UI chỉ diễn giải**: mỗi action trả về danh sách `GameEvent` (`HAND_EVALUATED`, `CARD_SCORED`, `SCORE_FINALIZED`…) để Animation Queue ở Phase 5 tiêu thụ.
- **Evaluator không biết Joker**: Four Fingers / Shortcut / Splash / Smeared được truyền vào qua `EvaluationRules`; engine sẽ suy ra rules từ các modifier đang active.
- **`containedHands`**: kết quả đánh giá liệt kê mọi hand chứa trong bộ bài (ví dụ Full House chứa Three of a Kind, Two Pair, Pair) — Joker kiểu "nếu hand có Pair" đọc trường này.
- **Selection là UI state**: `selectedCardIds` nằm trong Zustand store, không thuộc GameState và không được replay. `PLAY_HAND` nhận `cardIds` theo thứ tự trái → phải.

### Luật Poker đã có test

- 12 hand, Royal Flush tính là Straight Flush.
- Ace thấp (A-2-3-4-5) và cao (10-J-Q-K-A), không vòng (Q-K-A-2-3 không phải sảnh).
- Scoring cards: kicker không tính; High Card chỉ lá cao nhất; Stone luôn tính; Splash tính tất cả.
- Wild tính mọi chất; Stone không có rank/suit và phá flush.
- Debuffed card vẫn tạo hand nhưng đóng góp 0 chip.
- Flush House / Flush Five yêu cầu các lá của Full House / Five of a Kind nằm trong flush.

### Điểm cần xác minh khi làm faithful

- Four of a Kind có được tính là "contains Two Pair" hay không (hiện tại: không — cần hai rank khác nhau).
- Four Fingers: Straight Flush hiện được công nhận khi tồn tại cả straight 4 lá và flush 4 lá (lấy hợp các lá).

## Bước tiếp theo (Phase 3)

1. `engine/scoring/ScoringPipeline.ts` khởi đầu từ `scoreBasic` breakdown.
2. `engine/effects/`: `TriggerType`, `EffectResult` (`ADD_CHIPS`, `ADD_MULT`, `X_MULT`, `RETRIGGER`…), `EffectEngine` duyệt Joker theo thứ tự.
3. `JokerInstance` trong `PlayerState`, `content/jokers/` với 15 Joker đầu tiên.
4. Enhancement (Bonus, Mult, Glass, Steel, Lucky, Gold), Edition, Red Seal retrigger.
5. Test combo Joker + thứ tự kích hoạt.
