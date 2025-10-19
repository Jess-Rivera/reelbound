# Stop Button Progres


## Approach

Before writing code, define the data contract for that spin session—what fields represent each reel’s state, how often they update, and how the session signals “all reels locked.” Once that model is clear we can sketch the API changes (startManualSpin(), stopNextReel(), finalizeSpin()), then update ReelHandler to consume the new state instead of inventing its own timings.

Define new state machine: decide how to track reel statuses (spinning, pending stop, stopped), current reel index awaiting a manual stop, and remaining timer.

Expose stop controls: add Stop button wiring in main.ts, disable Spin until all reels reset, and trigger the “stop next reel” action on each press

Modify ReelHandler: add an explicit “stop reel i now” pathway that slows spin speed, freezes a strip at the correct cell, and updates the UI preview logic.

Add preview UI: extend inspector or overlay to show the upcoming icon for each spinning reel, reading from strip + offset without affecting scoring rows.

Integrate timer: create a countdown (probably in RoundManager) that ticks during manual control; hook into rendering to show it and auto-stop remaining reels when it reaches zero.

Update SlotMachine / round flow: ensure manual stops translate to fixed reelPositions, prevent further advances after each stop, and resolve the spin once every reel is stopped (manual or timeout).

Test edge cases: early button mashing, timer expiry mid-spin, resume flow when new round starts, and compatibility with existing inspector/debug panels.

//fix pulse animation

## Here’s how to wire the Stop control without editing anything yet:

HTML hook first: in index.html, give the Stop button a unique id (e.g., id="stop"). You already query #spin around main.ts:132, so mirror that pattern.

Capture the element: near the block where spinButton, lockButton, and other controls are retrieved (main.ts:132-170), add const stopButton = document.querySelector<HTMLButtonElement>('#stop');. Keep the null guard pattern you use for the spin button.

Track session state: at the top of the bootstrap function (next to let currentOrder, orderLocked, etc., around main.ts:98), introduce a variable such as let manualSession: ManualSpinSession | null = null;. This gives both event handlers a shared reference.

Kick off manual spins: inside the existing spin-button handler (after the roundManager.spin() call is replaced with your new manual flow), create the session: manualSession = slotMachine.startManualSession();. Immediately disable the spin button (spinButtonEl.disabled = true;) and enable the stop button (stopButton!.disabled = false;).

Handle Stop presses: register stopButton.addEventListener('click', ...) right after the spin handler is set up. In that callback:

Guard for manualSession being active.
Call a slot-machine method like slotMachine.requestStopNextReel(manualSession);.
If the session reports all reels are now stopped, disable the stop button, re-enable the spin button, and advance the round manager (roundManager.completeManualSpin(manualSession) or whatever finalizer you design).
Prevent duplicate stops: after each stop request, check the session’s status. If it returns 'pending_stop', leave the stop button disabled until the reel finishes decelerating; re-enable it once the session emits the next 'spinning' state. That avoids double-clicks during easing.

Reset after completion: when you detect manualSession.status === 'complete' (whether from the stop handler or a timer callback), clear manualSession, re-enable the spin button if the round has spins remaining, and reset any UI you added (timer, previews). If no spins remain, fall back to the existing round-ending logic.

Following those steps keeps all control wiring localized to main.ts, respects the existing button structure, and sets you up for the next steps (timer integration and reel-state plumbing).