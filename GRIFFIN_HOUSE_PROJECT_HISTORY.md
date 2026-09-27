# Griffin House Project History

## Jerome Griffin + ChatGPT

**Started:** September 27, 2026\
**Purpose:** A durable history of the Griffin House projects and the
working collaboration behind them. This is not a replacement for
technical release notes. It records the important *why*: major
decisions, breakthroughs, failures, workflow changes, and turning
points.

------------------------------------------------------------------------

## How this record works

This history is intentionally selective. Routine confirmations and minor
edits are omitted. Entries should be added when something meaningfully
changes the project, the development process, or our understanding of
what works.

Technical facts should remain factual. Where an old event cannot be
reconstructed with confidence, this record should say so rather than
inventing details.

------------------------------------------------------------------------

# 1. Griffin House Hold'em begins

In September 2026, Jerome began developing a commercial Texas Hold'em
game in Unity. The project evolved into **Griffin House Hold'em**, with
an original Griffin identity and a strong requirement that its assets,
branding, interface, characters, sounds, and other creative work remain
original rather than copying another poker product.

The project quickly grew beyond a simple card game. Its poker engine
came to include the dealing lifecycle, betting, blinds and dealer
rotation, showdown handling, main and side pots, split pots, chip
conservation, bust/rebuy behavior, cash-out, table sessions, bots,
achievements, audio, avatars, and increasingly ambitious presentation
work.

As the project became larger, preserving working behavior became as
important as adding features.

------------------------------------------------------------------------

# 2. The cost of rapid iteration

Hold'em went through repeated cycles in which improvements in one area
could expose or reintroduce problems elsewhere. Among the recurring
issues were dealing/presentation timing, bankroll and table lockouts,
Return to Hand corruption, audio synchronization, UI overlap, and
table/card presentation problems.

This changed the development philosophy.

The project moved toward:

-   confirmed working checkpoints;
-   surgical changes instead of broad replacement;
-   protecting known-good source;
-   mechanics before cosmetics when the two conflicted;
-   explicit records of known regressions;
-   testing actual behavior rather than assuming a successful script or
    compile meant the game looked and behaved correctly.

One especially important rule emerged: a small problem should never be
"fixed" by casually replacing the entire Unity `Assets` tree or
overwriting protected working files.

------------------------------------------------------------------------

# 3. Hold'em enters the tedious cleanup phase

By late September, Hold'em had reached a phase that was much less
exciting than creating new systems. Jerome was spending substantial time
on repetitive cleanup, regression testing, Unity checks, small fixes,
file replacement, and retesting.

This became the **primary reason Hold'em development paused**.

Jerome had not lost interest in the poker game. The problem was that
development had reached a labor-intensive cleanup stage where too much
of the work required repetitive manual attention.

------------------------------------------------------------------------

# 4. The Codex/worker idea changes the plan

During that cleanup, Jerome became excited about using **Codex/workers
on the Windows PC** to help perform repetitive development work.

The attraction was specific: instead of Jerome manually carrying out
every tedious cleanup operation, Jerome and ChatGPT could direct the
project while workers handled more of the repetitive implementation and
checking.

By September 21, Codex CLI and Node.js were installed and the local
Codex installation itself was substantially working. Authentication
became the blocker.

Both normal OAuth and device-code login reached phone verification.
Jerome's existing phone number was rejected as already in use. Jerome
did not want API billing, another account, another phone number, or
someone else's number merely to get around the problem.

Support was contacted, and Jerome eventually chose to preserve the setup
and wait rather than continue fighting authentication.

That interruption mattered enormously: the worker workflow had been
expected to make the tedious Hold'em cleanup manageable. When phone
verification blocked it, Hold'em lost momentum.

Jerome's later summary of the event was more accurate than a
reconstruction based only on surrounding project events:

> The absolute number one reason poker stopped was that we were in the
> middle of a very, very tedious cleanup, Jerome got excited about Codex
> and having workers work with ChatGPT on it, and then the
> phone-verification problem stopped that plan.

This distinction is important to preserve. **Rook did not originally
cause Hold'em to stop. Rook grew into the available space after the
intended automation path for Hold'em was blocked.**

------------------------------------------------------------------------

# 5. Griffin House of Rooks takes off

Jerome already had a functioning Rook card game built in HTML/JavaScript
and began exploring what it could become with the richer presentation
being envisioned for poker.

A Unity project was established as **Griffin-House-of-Rooks**, with
careful separation from the Hold'em Unity project so the two projects
could not contaminate one another.

Early Unity work established core Rook match/round behavior and tests,
while Blender work explored the physical table, rails, card placement,
and presentation.

The Rooks work reinforced another important engineering lesson:

**Script success is not visual success.**

A script could execute perfectly while the resulting table still looked
wrong. User-confirmed visual states therefore became protected
checkpoints rather than something to modify casually for cosmetic
experimentation.

------------------------------------------------------------------------

# 6. The actual Rook game becomes the center of attention

The existing HTML/JavaScript game remained valuable because it was
already playable and could evolve rapidly.

Jerome later clarified an important terminology rule:

**"Real game" means the actual Griffin House of Rooks HTML/web game.**

It does not mean the Unity project, Blender experiments, a prototype, or
the Visual Lab.

Development increasingly concentrated on improving that real game:
presentation, avatars, sounds, multiplayer behavior, landscape and
portrait layouts, room atmosphere, progression planning, and
release/deployment workflow.

The project was eventually divided conceptually into separate lanes:

1.  **Live Game Work** --- the production Griffin House of Rooks web
    game.
2.  **Visual Lab** --- a safe experimental environment for visual/table
    concepts.
3.  **Griffin Rook Installer** --- the separate Android
    installer/updater project.

This separation allowed ambitious experiments without casually
destabilizing the playable game.

------------------------------------------------------------------------

# 7. Workflow lessons become explicit rules

Repeated version drift, partial patches, uncertain baselines, and
regressions eventually forced a better process.

Jerome established several rules that now define the collaboration:

### Build → Critique → Rebuild

For substantial work:

1.  Produce the first solution internally.
2.  Critique it hard for mistakes and weaknesses.
3.  Rebuild/polish it.
4.  Deliver the third-pass result.

Jerome should not have to repeatedly ask ChatGPT to "think about it
again."

### Bank changes until ROLL

For Griffin House of Rooks:

-   **OK / go / continue** means continue the discussion or work and
    bank the decisions.
-   It does **not** authorize another package.
-   **ROLL** means stop planning and actually build the cumulative
    update.

This rule was created partly to stop the proliferation of unnecessary
incremental ZIPs.

### One authoritative baseline

The project increasingly moved away from ambiguous collections of
patches.

A full known-good build should become the authoritative baseline.
Changes can still be surgical internally, but a major roll should
produce a complete verified build so there is no uncertainty about which
old files are supposed to coexist with which new files.

------------------------------------------------------------------------

# 8. Rook514 and the return to full authoritative builds

On September 27, the Rook514 work exposed exactly why the
authoritative-build rule mattered.

A small 514 overlay had successfully introduced new visual files,
including the room treatment, portrait changes, landscape styling, and
Jerome avatar, while portions of the application still identified and
cached themselves as version 513.

The result was not necessarily broken, but it was conceptually untidy:
part 514 and part 513.

Jerome supplied the complete `Rook513_FINAL(1).zip`, giving the project
a trustworthy full pre-514 baseline.

The workflow was then changed deliberately:

**full working ZIP → bank changes → ROLL → surgical modification inside
that exact source → three-pass review → complete next-version ZIP → that
ZIP becomes CURRENT.**

Rook514 was subsequently rolled as a full authoritative package with
synchronized application/version/cache references and integrated 514
assets.

During this same period, Jerome accidentally extracted a large
collection of Rook files directly onto the Windows Desktop. The files
were safely quarantined rather than deleted. It was a minor accident,
but an excellent practical demonstration of why clean authoritative
packages and predictable file workflows matter.

------------------------------------------------------------------------

# 9. Jerome becomes an in-game avatar

During the Rook514 work, Jerome supplied his own portrait for the
selectable **Jerome** avatar.

The first asset included a gold circular frame baked into the image.
Because the game already provides its own circular crop/treatment, this
unnecessarily produced a circle inside a circle and reduced the useful
portrait area.

A frameless version was created and substituted as `avatar-jerome.png`.

This became one of the more personal milestones in the project: Jerome
was no longer merely building Griffin House---he had literally taken a
seat at the table.

------------------------------------------------------------------------

# 10. Why this history file exists

On September 27, Jerome began explicitly testing how much ChatGPT
retained about the collaboration.

ChatGPT could reconstruct a surprisingly large amount: the projects,
technical problems, workflow evolution, Codex setup, Rook's rise, and
many design decisions. But when asked why Hold'em had stopped, ChatGPT
initially identified several contributing factors without giving
sufficient weight to the actual number-one cause.

Jerome corrected the record: the tedious poker cleanup and the blocked
Codex/worker plan were the central reason.

That moment demonstrated both the usefulness and limitation of AI
memory.

Useful context can persist, but it is not a perfect autobiographical
transcript. Important causal details can be underweighted or eventually
lost.

Jerome therefore decided to begin this file.

Its purpose is simple:

**Important parts of the Griffin House story should belong to Jerome in
a durable file, rather than depending entirely on what a future AI
session happens to remember.**

------------------------------------------------------------------------

# 11. Current philosophy

The Griffin House projects have gradually developed a shared philosophy:

-   Preserve working systems before chasing novelty.
-   Distinguish an actual tested result from a claim that code "should"
    work.
-   Keep experiments away from production when possible.
-   Maintain authoritative checkpoints.
-   Record why important decisions were made, not merely what files
    changed.
-   Let automation remove repetitive labor without surrendering human
    direction.
-   Treat AI as a collaborator/tool whose output must still be tested
    and challenged.
-   Never allow version confusion to become an invisible dependency.
-   Preserve the history well enough that another session---or another
    future system---can understand how the project arrived at its
    current state.

------------------------------------------------------------------------

# Future entries

Future entries should be added only for meaningful milestones: major
releases, important design decisions, project pauses/resumptions,
significant failures and recoveries, workflow changes, major technical
breakthroughs, and moments that materially shape the Griffin House
projects.

The record should remain readable enough that Jerome can open it years
later and understand not only **what was built**, but **how and why it
became what it is**.


## Rook515 milestone — September 27, 2026
Rook514 was the first web presentation that made Jerome seriously question whether the Unity conversion was worth finishing: the cinematic avatars and Griffin House room background finally delivered much of the intended atmosphere without continuing the extremely tedious Blender/card-holder work.

Jerome immediately identified two remaining defects: rectangular team/seat boxes behind portraits and the Play With Friends PeerJS connection/load issue. Rook515 was explicitly authorized with **ROLL** to attack those two problems while protecting the successful Rook514 room/table/card composition.

Inspection found the boxes were reintroduced by `paintNamePlaque()`, which wrote inline `!important` team backgrounds stronger than the cleanup CSS. Multiplayer inspection found `index.html` requested a nonexistent local `vendor/peerjs.min.js` before CDN fallback. Rook515 removes live-table plaque paint, preserves team metadata, removes that guaranteed missing-file request, and adds redundant PeerJS loading for host/join.


## Rook516 candidate — September 27, 2026
Jerome explicitly authorized ROLL after banking a cumulative visual-polish pass: persistent human avatar choice, larger portraits, active-player-only portrait motion, physical-looking hand rack with tiny card variation, removal of the center TRICK label, richer landscape felt while preserving large-card accessibility, smaller game-native achievements/popups, and removal of blue-bird Rook emoji. Rook516 also carries forward the Rook515 seat-box and PeerJS fixes. The Rook514 room background was inspected directly and retained. Rook516 is a candidate until Jerome installs/tests it.
