843 — Results heading and room finish audio

Continues delivered 842.zip. No deployment. 842 remains the rollback.

FIXED
The general in-game HUD rule outranked the existing hide-on-results rule. The match score/contract bar and speed controls now stay hidden during both the victory announcement and the match recap, in portrait and landscape. The recap retains its own scores and actions. Normal gameplay HUD rules resume when results close.

ENDING SOUND TRIAL
A fixed, quiet recorded glass clink closes an ordinary hand. A three-second recorded small-audience applause closes a match. These are existing licensed game assets, unchanged; no synthetic fanfare was added. Highlight replays no longer repeat the card-gather cue. Receipts prevent repeated score openings/rotation from replaying either finish. The final hand skips the ordinary-hand cue. Global mute, game-effects volume and existing card/effects toggle apply. A match finish also reserves the applause cooldown so following award toasts do not repeat it. Existing bird reveal crowd and fight sounds are unchanged.
The exact odd sound reported on the physical phone has not been positively identified; existing result functions were silent in 842. This is a cleaner replacement finish for owner listening review, not a claim of physical-device audio certification.

VALIDATION
Results header fixture reproducing the reported 65–535 recap: portrait 390x844/432x936 and landscape 844x390/844x245, no live HUD overlap. HUD display rule restores after results close. Viewed final portrait recap with all four cards/actions visible.
Audio routing fixture: one cue per new hand, no cue on the final-hand scoreboard, one match applause, no repeat on reopening/duplicate payload, no historical score cue during active play.
55 native regressions passed, including a complete played hand to scoring, card/discard drag geometry, Kitty Received, ordering, rotation/bid persistence and menu reachability. Zero page errors or missing assets. Fresh active-worker offline reload has coherent 843 runtime and approved effects ready.
No new full multi-match audit or live network multiplayer session was run for this scoped repair.

AUTHORITY
Current Master Brain AE and full-history reading remain retained from this continuous workstream. Both permanent continuity/reading rules remain verbatim in their review-continuity files. Every future handoff and startup prompt must reproduce BOTH full rules verbatim and require their successors to do the same.
