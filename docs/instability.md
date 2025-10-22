Heard: no hard caps on scoring. Lucky spins should go nuclear and builds should fully express—especially for Infinite. Cool. Let’s swap the “caps” for **uncapped-but-unstable** systems that scale risk faster than reward without clipping the ceiling.

# Uncapped, but increasingly unstable

### 1) Instability, not caps

Define a post-resolution **Instability score** `I` (0–∞) that never blocks payout but increases tail-risk:

```
I = a*(Heat/100)^γ  +  b*(helpers_fired)^β  +  c*(rewrites)^ρ  +  d*(Payout/Power)^α
```

* Start with a=0.6, b=0.3, c=0.2, d=0.4; α,β,ρ≈1.0–1.5; γ≈1.6–2.0 (superlinear with Heat).
* High payouts and long chains explode I, but nothing is capped.

Roll **instability events** after scoring (ordered by severity, each with its own chance derived from I; all independent so truly wild turns can stack):

* **Glitch (p ≈ S(I))**: randomly re-score one already-scored pattern at ±(10–40%) variance (could be more).
* **Corruption (p ≈ S(I-1))**: convert 1–2 high-tier icons to “corrupted” versions for the *next spin* (higher mult but drains HP or adds Heat on use).
* **Dropout (p ≈ S(I-2))**: remove the **highest-earning** pattern from *this* spin’s total (insurance counters below can prevent).
* **Servo Burn (p ≈ S(I-3))**: disable one helper family *next spin only*.
* **Reel Desync (p ≈ S(I-4))**: next spin’s stop window shortens (skill pressure).

`S(x)` can be a logistic (e.g., `1/(1+e^(-k*x))`, k≈0.9) so early risk is mild, late risk goes spicy.

### 2) Entropy debt (carryover risk, not a cap)

After massive spins, carry an **Entropy Debt** `D` into future spins:

```
D_next = λ*D + μ*(Payout/Power) + ν*helpers_fired
```

`D` passively increases Heat gain by +η*D and slightly boosts Instability (e.g., add `+0.2*D`). Mechanic/Repair nodes, items, or “cooling” spins pay it down. You *keep* your jackpot—future risk just climbs until you cool off.

### 3) Volatility tax on precision (soft aim-jitter)

At high Heat or high I, **targeting fidelity** drops a bit:

* Helpers have a small chance to “miss” their ideal replacement within a **thematically nearby** icon set (e.g., swaps to the same fruit family). That preserves spectacle, doesn’t slash payout, but prevents deterministic infinite engines.

### 4) Insurance & hedges (player agency)

* **Fuse Lock (consumable)**: prevents **one** severe event (Dropout/Servo Burn) this spin.
* **Cooling Purge (item)**: cash in 15–25% of this spin’s payout to zero `D` and reduce Heat by X.
* **Ground Strap (machine part)**: reduces `d` coefficient vs payout—great for infinite grinders.

### 5) Infinite mode fairness

Keep `T` scaling exponential (your saw-tooth reset each map stays), but because scoring is uncapped, let monsters push **risk**, not just numbers:

* “Arc-King”: +30% to `d` (payout→instability coupling).
* “Heat Leech”: adds `+κ` to γ (Heat punishes faster).
* “Servo Jammer”: raises β (long chains cause more I).

# Why this beats caps

* Big spins still hit like meteors.
* The **expected value** stays in check at scale because tail-risk rises superlinearly.
* Players can **opt into** risk (Risky spins, overspin) and bring tools to manage it (insurance, purge).
* Build expression stays intact; the game simply asks, “Do you really want to ride this lightning?”

# Numbers to try (Cassie 3×3 starter)

* `Power`: your current hidden max-pattern estimate.
* Coeffs: `a=0.6, b=0.3, c=0.2, d=0.4, γ=1.8, α=β=ρ=1.2`.
* Debt: `λ=0.5, μ=0.6, ν=0.3, η=0.02`.
* Event thresholds via `S(x)` with `k=0.9`: Glitch at `S(I)`, Corruption `S(I-1)`, Dropout `S(I-2)`, Servo `S(I-3)`, Desync `S(I-4)`.

# Two sharp pushbacks to validate

1. Do you want **Dropout** to ever delete the whole best pattern, or should it **attenuate** it (e.g., -40–60%) so players don’t feel robbed?
2. Should **Entropy Debt** also nibble at tickets payout (e.g., -1 ticket when D>3) to keep meta-progression honest on jackpot farming?

If you’re good with the above, I’d tune only `γ` and `d` first—those two knobs alone set “how crazy” lucky spins can go before the machine starts spitting sparks.
