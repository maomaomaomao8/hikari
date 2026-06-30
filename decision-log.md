## 2026-06-30 — Claude API for data synthesis vs hardcoded formula

**Options considered:**
- Hardcoded math: write a static formula (birth rate × feeding frequency ÷ 24hrs)
- Claude API: send real parameters to Claude and let it reason through the estimate

**Picked:** Claude API

**Result:** Claude returned 80,000 at 21:03 UTC with full reasoning — factored in time zones, weighted nighttime vs daytime, adjusted for shared caregiving moments. A static formula would have missed the time-zone weighting entirely.

**What this tells me:** Claude adds real value on tasks where the inputs are ambiguous or require judgment (what counts as "nighttime," how to weight emotional context). For pure arithmetic it would be overkill. The line is: does the problem require reasoning or just calculation?

**Confidence at the time:** Medium (wasn't sure if the reasoning would be defensible or just plausible-sounding)
**Outcome confidence:** High — the reasoning chain is transparent and each step is checkable

## 2026-06-30 — Copy generation: prompt constraint testing

**The constraint:** Presence only, never comparison. No "powering through," no "struggling," no motivational framing.

**Test:** Ran copy generation 5 times, logged all outputs.

**Results:**
1. "Around 77,000 parents are sitting in this moment with you right now, holding their babies."
2. "Around 77,000 parents are here with you right now, in this same quiet moment, feeding someone small."
3. "Around 77,000 parents are sitting with a newborn in their arms right now, just like you."
4. "Around 77,000 parents are sitting in this moment with you right now, holding their newborns."
5. "Around 77,000 parents are in this exact moment with you right now, feeding someone small."

**What this tells me:** The constraint held consistently across all 5 runs with no drift into comparison or motivational language. Variation was in phrasing detail ("babies" vs "newborns," "holding" vs "feeding") not tone. The prompt constraint is doing real work — this isn't just Claude defaulting to nice-sounding output, it's following a specific rule reliably.

**Confidence at the time:** Medium (wasn't sure if Claude would drift toward "you're not alone" framing)
**Outcome confidence:** High
