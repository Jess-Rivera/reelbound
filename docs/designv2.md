# Summary
Slay the Spire and Clover Pit inspired roguelike, using pixel art graphics.

## Next time
Sure. Right now isMachineConfig knows how to validate patternIds if you hand it a set of valid IDs. The next concrete task is to actually build that pattern registry when the spike starts up:

Author a spike/data/scoringPatterns.json (or similar) that contains every ScoringPattern definition. Each entry must have a unique id.
In spike/main.ts, load that JSON first. Build a Map<PatternId, ScoringPattern> from it and a Set<PatternId> with the keys.
Load your machine JSON (selectableMachines.json) and, for each machine entry, call isMachineConfig(rawMachine, patternIdSet). That ensures every patternIds reference points to something real in the pattern registry.
When a machine passes validation, store the machine config plus a resolved list of ScoringPattern objects (by looking up each patternId in the map). That resolved data is what the runtime will use.
So “next step” means wiring up this loading/validation pipeline in the bootstrap: create the pattern map, feed it into the machine validator, and fail fast if a machine references a missing pattern.




## Core Loop
- Player begins by selecting an available machine.
	- The game begins with 3 basic variants available.
	- Unlock new machines through gaining "Contracts", a meta progression point, and purchasing them from the Patron.
- The player then selects a difficulty:
	- Easy | Normal | Hard | Extreme | Infinite
- The player then goes through a number of maps depending on the difficulty chosen.
	- Easy: 3 | Normal: 5 | Hard: 8 | Extreme: 13 | Infinite
- Maps 
	- A level consists of a layered, branching node graph. A map has between 7-10 layers.
	- The total available nodes are created from a 7 wide (nodes) by 7-10 tall(floors) isometric grid.
	- Starting from floor 1 (bottom most), a randomly selected node is enable. Then it connects with a Path to one of the 3 closest nodes on the next floor up. It continues this pattern until it reaches the top most floor (between 7 and 10).
	- This process is repeated 6 more times using the following additional rules:
		- If floor 1 has fewer than 3 enabled nodes, select a new node to enable on floor 1.
		- Paths cannot cross over each other. (e.g. Floor 2 Node 3 connects to Floor 3 Node 4. This means that Floor 2 Node 4 cannot connect to Floor 3 Node 3) Paths can however overlay each other.
		- If the final floor on the map has 4 or more enable nodes, no new nodes can be enabled.
	- Each enabled node has the floowing percentages for Location
		|-------Location-------|-----Percentage Chance-----|
		| Monster			   | 45%					   |
		| Event                | 22%					   |
		| Elite                | 15%					   |
		| Mechanic (Repair)    | 12%					   |
		| Merchant             | 05%					   |
		| Treasure             | 01%					   |
		|----------------------|---------------------------|
	- The following additional rules apply to Location:
		- Mechanic(Repair) can't be assigned to the penultimate floor on a map. 
		- The bottom half of the floors can't be Elites or Mechanic(Repair).
		- Elites cannot be consecutive on a path. Merchant cannot be consecutive on a path. Mechanic(Repair) cannot be consecutive on a path.
		- A node that has 2 or more paths going up must have all unique Locations. Two destinations from the same parent node cannot share the same Location.
		- If a location is assigned initially, reassign the Location until all rules are met.
- Fights
	- A Monster location will spawn a Fight. This is a separate screen from the Map screen.
	- A monster will be defeated by earning sufficient T credits in R rounds. The difficulty of the monster is adjusted with T and R modulated by the Map number M and Floor number F.
		- T is generated programmatically:
			- X = 1.15 * 1.06^(F-1) 
			- Nx = (X/1.19)^(1/Ny-1) where Ny is used to adjust the ramp down between maps and initially set to 5.
			- C = Cb * 1.19^(N-1) * Nx^(N-1) where Cb is used to adjust curve ramp speed and initially set to 10. C is base credits for a given Floor and Map
			- T = Cb * Mm * Dm * (1+Hp) where:
				- Mm is the monster multiplier depending on type of monster:
					- Base .8-1.2 | Elite 1.2-1.5| Boss 2.8-3.0
				- Dm is the difficulty multiplier depending on difficulty selected for the run:
					- Easy 41 | Normal 45 | Hard 49 | Extreme 53
				- Hp is a percentage increase for special event monsters, value between 0 and 1.
		- R is manually set as a specific difficulty curve, defaults to 3.
		- Monsters on the same Map/Floor are differentiated with traits.
			- Traits are effects that manipulate a factor of the player. E.g. "Fruit Eater - In the Post Scoring phase, all win conditions that are fruits are worth 10% less"
	- Each Round will present a choice of Safe spins, 6 spins for 1.0x multiplier to credits earned, or Risky spins, 3 spins for 2.0x multiplier to credits earned.
	- Each spin will start when the player presses the Spin button. The player then has a spin timer, based on the machine chosen, to stop all the reels. If any reels are still spinning at the timer end, they all stop automatically. 
	- The grid spins vertically (top to bottom) then horizontally (left to right), each column then row must be stopped.
		- Ex. Classic Cassie has NxM grid of 3x3. All 3 columns begin spinning top to bottom. The player must press stop to stop each subsequent reel, Column 1 Column 2 then Column 3. Once all Columns are stopped, then the Rows begin spinning left to right with the same stop functionality. Row 1 Row 2 then Row 3. 
	- The player's Pre-Scoring Items check for conditions. E.g. A Horizontal Helper seeks for a H-1 icons and seeks to complete the pattern. 
		- All helpers of the same family run sequentially, passing their modified board forward.
		- Each helper’s change is scored immediately.
		- When that family finishes, revert to the initial spin result.
		- Pass that original to the next family type.
		- Heat accumulates per helper fired + per-tile total rewrites.
Final score = sum of all chain scores.
	- Once the grid is fully set, scoring occurs in the available conditions for the given machine.
		- E.g. Classic Cassie is a 3x3 and so can score on Horiztonal 3, Vertical 3, Diagonal 3. Default Dwight is also a 3x3 but is an unlockable machine that can score on Horizontal 3, Vertical 3, Diagonal 3, Corners, Pluses. 
		- E.g Stretched Sam is a 3x5 and can score on:
			-Horizontal 3, 4, 5 | Vertical 3 | Diagonal 3 | Corners | Pluses | Empty Box | Positive Chevron | Negative Chevron | 
		- Each win condition scored grants Heat.
	- The player's Post-Scoring Items check after all win conditions are determined and apply to all applicable conditions unless stated otherwise. e.g. An item that increases the multiple of a horizontal run for each time it is scored.
	- When the player has earned enouch credits to meet or exceed the target T and prior to R rounds completing, the monster is defeated. The player gains 5+ tickets based on efficiency, streak, highest scoring condition, etc
	- If the player does not earn enough credits in R rounds, the player can choose to Run or Overspin.
		- Run: The player loses Health equal to between .1 and .3 of the monsters target credits T. 
		- Overspin: The player can continue additional rounds with an increasing Heat gain.
	-Phases for Items and Traits
		- 1. Pre-Spin | 2. During Spin | 3. Post Spin/Pre-Scoring | 4. Scoring | 5. Post-Scoring | 6. Final Spin Score
- Mechanic (Repair)
	- The player will be given an option to heal or reduce heat in exchange for tickets.
- Merchant 
	- The player will be able to buy items for tickets. 
- Heat
	- Heat is a mechanic meant to grant bonuses for scoring well and act as a penalty for overspinning. 
	- During a fight before R rounds, Heat can be: Cold | Warmed Up | On Fire. Heat is capped at On Fire during a round unless otherwise stated or monster effects. 
		- Cold is 0 Heat and has no effects.
		- Warmed Up is >0 heat and less than the On Fire starting value for a given machine. Warmed Up grants a bonus that is machine dependent. 
			-E.g. Classic Cassie's Warmed Up bonus is fruit score change from 10 to 12.
		- On Fire is from the On Fire starting value to 100. On Fire grants a bonus that is machine dependent and is inclusive of the Warmed Up bonus.
			-E.g. Classic Cassie's On Fire bonus is Lemon score is changed from 10 to 14 and Horizontal 3 multiple is changed from 1 to 1.1.
	- During Overspin, Heat becomes uncapped and can now achieve: Burning Up | Breakdown. 
		- Burning Up is from 100 to 150. Burning Up is not machine dependent and grants a flat 10% increase to scoring and a Heat Gain multiple of 1.1. The Heat Gain multiple rises by 0.1 for each round in Burning Up, reset by the reducing heat to below 100. 
		- Breakdown is >150. Scoring loses the flat bonus from Burning Up and becomes a flat penalty of 15%. There is also a 10% chance each that a win condition will not score. 
	- Heat 
		Heat per spin = Wins + Helpers + Rewrites
			Let:
				P_i = payout (credits) of the i-th scored pattern this spin
				Power = machine’s “max plausible single-pattern payout” (your hidden stat)
				Hb = base heat scale for any win (machine-tunable)
				α = sublinear exponent (keeps big wins impactful but not explosive; try 0.5)
				F_family(i) = family factor for the i-th pattern (e.g., Row 1.00, Col 1.10, Diag 1.20 for Cassie identity)
				H_base = heat for each helper firing
				H_chain(f,k) = extra heat for the k-th helper inside family f (encourages long intra-family chains)
				H_rewrite = heat for re-writing a tile a 2nd+ time this spin (across families)
				W = total count of 2nd+ writes across all tiles this spin
				monsterOverspin = flat percentage increase, default 1.0
			Wins Component
				H_wins(spin) = Σ_i  max(1,  Hb * (P_i / Power)^α * F_family(i) )
			Helpers & Rewrites
				H_helpers(spin) = Σ_f Σ_{k=1..R(f)} ( H_base + H_chain(f,k) )
				H_rewrites(spin) = W * H_rewrite
			Total
				Heat_gain(spin) = (H_wins + H_helpers + H_rewrites) * monsterOverspin
			Tuning Tests:
				Hb = 8
				α = 0.5
				F_family: Row 1.00, Col 1.10, Diag 1.20
				Conservative tune: H_base=3, H_chain(f,k)=(k-1), H_rewrite=2
				Spicy tune: H_base=4, H_chain(f,k)=1+0.5*(k-1), H_rewrite=3
- Contracts
	- Contracts are a currency that persists between runs and is used to purchase unlocks from the Patron. 
	- Contracts are earned at the end of a run, success or failure. 
		- Gain 1 contract per floor completed. 
		- Gain 10 contracts per map completed. 
		- Only keep 50% of contracts earned in a run on failure. 
			-Ex a player dies on Map 2 floor 3. Map 1 had 8 floors. So they earned (8 + 10 + 3) * .5 = 10 contracts. 
	- Unlock Categories:
		- New Machines
		- Machine Parts - upgrades you can enable to enhance a run
	- Unlock Pacing: Early unlocks will take between 3-5 runs each while late game unlocks will take 12. This scales logarithmically.
- Alchemy 
	- Deferred for now, but idea is on Map 2 onwards, a new shop type appears that allows the player to combine icons into new higher multiple icons. 
		-e.g. a player can take 5 cherries + 5 lemons -> 5 strawberries that have a 1.3 base multiple.


	| Machine tier           | Example machine   | Grid / patterns                             | Suggested `heatNormalization` |
| ---------------------- | ----------------- | ------------------------------------------- | ----------------------------- |
| **Baseline**           | Classic Cassie    | 3×3, H3/V3/D3 only                          | **400–600**                   |
| **Plus patterns**      | “Default Dwight”  | 3×3, +Corners/+Plus                         | **600–800**                   |
| **Wider grid**         | Stretched Sam     | 3×5, long lines + shapes                    | **900–1300**                  |
| **Late-game volatile** | “High-end unlock” | bigger grids / richer shapes / higher mults | **1400–2200**                 |
