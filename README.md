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

## Trạng thái

| Phase | Nội dung | Trạng thái |
| --- | --- | --- |
| 1. Foundation | Vite/React/TS, Card model, Deck, Seeded RNG, replay | ✅ |
| 2. Poker Engine | 12 Poker Hands, Scoring Card Resolver, Hand Level, Planet | ✅ |
| 3. Scoring & Effects | `ScoringPipeline`, ~55 Joker, retrigger, Enhancement/Edition/Seal | ✅ |
| 4. Gameplay Loop | Blind select, 15 Boss, Cash out + interest, Shop (reroll, mua/bán) | ✅ |
| 5. Visual & Animation | `motion`, shader nền WebGL, âm thanh WebAudio, confetti, CRT | ✅ (chưa kiểm tra kỹ trên trình duyệt) |
| 6. Content Expansion | 21 Tarot ✅ · Spectral, Voucher, Booster Pack, Skip/Tag | ⏳ |
| 7. Polish | Auto-save (localStorage, replay action log), Options | 🟡 |

Luồng: `BLIND_SELECT → PLAYING → ROUND_WON (cash out) → SHOP → BLIND_SELECT …`, thắng Boss Ante 8 = VICTORY.

### UI / hiệu ứng

- Engine tính xong ngay; store giữ `game` (sự thật) và `view` (đang hiển thị). Khi PLAY_HAND, store phát lại từng `SCORE_STEP`
  (popup +Chips/+Mult/XMult trên đúng lá bài/Joker, âm cao dần, rung màn hình khi XMult, lửa khi vượt mục tiêu) rồi mới gán `view = game`.
- Kéo thả sắp xếp bài trên tay và Joker (`Reorder` của motion), click để chọn. Phím: `Enter` đánh, `D` bỏ, `Esc` bỏ chọn.
- Nền: shader "sơn xoáy" tự viết (`ui/fx/ShaderBackground.tsx`), đổi màu theo Boss/Shop/thua/thắng, tăng tốc khi chấm điểm.
- Âm thanh tổng hợp bằng WebAudio (`ui/audio/sfx.ts`), không có file asset.
- Font: Pixelify Sans + VT323 (`@fontsource`). Package mới: `motion`, `canvas-confetti`, `clsx`.
- Tôn trọng `prefers-reduced-motion`.

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
│   ├── scoring/            # ScoringPipeline (thứ tự kích hoạt kiểu Balatro)
│   ├── effects/            # JokerDefinition, Effect, TarotApi
│   └── shop/               # sinh item shop, giá, độ hiếm, edition
├── content/                # planets, jokers, tarots, blinds/bosses (registry dữ liệu)
├── features/               # game (store, HUD, hand, play area), blind, shop, menu
├── ui/                     # components (card, joker, consumable, popup), fx, audio
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

## Bước tiếp theo

1. Chạy thử trên trình duyệt, chỉnh thời gian animation / kích thước card cho màn hình nhỏ.
2. Booster Pack + Spectral, Voucher, Skip Blind + Tag.
3. Code-split bundle (vite cảnh báo >500 kB), lưu bằng IndexedDB nếu cần.
