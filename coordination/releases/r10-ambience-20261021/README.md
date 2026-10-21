# R10 ambience level repair — 2026-10-21

Owner confirms the preceding online card-sound repair works on the phone; ambience remains inaudible. Preserve that confirmed card repair and approved male voices/portrait repairs.

## Cause and change

Owner diagnostic has running cabin context, enabled/nonzero settings and fire/wind sources. Preserved PCM equals the source WAV levels: fire RMS−61.2dBFS, wind−70.4dBFS. Saved cabin6% => bus0.2 and fire10% compound this to estimated fire−95.2dBFS / wind−84.3dBFS. Source provenance explicitly says deliberately low-level recordings. R9 context recovery was not the complete symptom fix.

R10 adds one fixed recording gain100 (+40dB) and a shared soft ceiling only in the cabin output path. Combined ambience routes bus -> recording gain -> WaveShaper curve(0.45*tanh(x/0.45),2x oversampling) -> existing atmosphere mixer. Saved master/channel/cabin/fire/per-sound settings and zero/mute remain unchanged. Same original PCM/recordings, schedules, fades and wildlife rules. Output curve values remain below0.45; this reserves headroom for loud combinations, not a claim of physical speaker maximum. Old output-chain nodes disconnect after fade; stale stop timer cannot disconnect a replacement chain. No voice/gameplay/character output routing changed.

Native runtime846-r10-ambience-levels-20261021. All three sites must be updated together. Root native behavioral change: cabin-ambience041.js only. game060.js, index.html, hor-version.js and sw060.js carry release/cache identity changes. No cache clear/unregister, audio asset replacement, approved portrait changes, room reset or paid services. Immutable native Test source 90078a710948c7643caafb18986e34dc71ce7cee.

## Verification

Original R9 fails real-PCM graph test at wind−84.3dBFS. Candidate estimates wind−44.3 and fire−55.2 at unchanged defaults. Real preserved PCM traverses actual module-created graph in a simulated AudioContext; validates output/mixer category, gain applied once, bounded curve, repeated tap/recovery no duplicate loops, saved preferences, slider zero/mute, maximum slider headroom and stale-stop cleanup. It is not actual browser audible acceptance. Existing context-recovery, confirmed cloud-card audio, entry/create/invite, privacy and collection/reconnect regressions pass. Local changed-file formatting passes; GitHub source checks pending before publication. Cloud Browser native credential runtime still unavailable; do not repeat authentication loops.

## Release controls

Rollback before this native release: Test517c308a9aa21e518908344020835a3a00ff8a68, production70cc652f0a425f2b3428aa3f7db17f1dc36ef0a8, Cloudflare60c2b7e7-3787-4b09-be10-d232f988b6d9. Both repositories retain rollback/pre-r10-ambience-20261021. The previous card repair remains in the R10 adapter; only accepted native marker and immutable pin change. Existing namespacebb1bf1c32b68451cbe5db6fee3066fa0, signing secret, rate bindings and disabled preview URLs retained. User explicitly authorizes continued repair/publication despite blocked browser audible testing; never describe phone ambience as confirmed until owner hears it.

No new ZIP. If one is requested later, include functional index.html at ZIP root and the complete cumulative game; do not deploy an old bundled Worker.
