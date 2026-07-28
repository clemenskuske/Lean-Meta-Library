# Plan: moving Lax submissions to GitHub Actions

Status: discussion draft, 2026-07-28. Nothing here is final; the goal is a
shared picture so we argue about the same design.

## What we're trying to get

Today one server does everything: it accepts submissions, runs the
expensive checks (including compiling author-supplied Lean code), stores
the results, and serves the website. The compiles are the part that has
hurt us operationally (memory pressure, sizing, being a single box), and
they are also the security-sensitive part: compiling a submission means
executing code the author controls.

The plan is to move the checking and the archival write path onto GitHub
Actions, so that:

- the expensive, dangerous work runs on throwaway GitHub machines instead
  of our box;
- the archive itself becomes a public GitHub repository with a fully
  auditable history, writable only by our automation;
- authors get submission status through a UI everyone already knows
  (a pull request with checks).

## The repositories: two, with different characters

**The code repo** (today's monorepo) stays one repo containing everything:
the CLI authors run locally, the checking pipeline, the website generator,
and the CI workflow definitions. This is deliberate: Lax's core promise is
that the checks an author runs locally are *exactly* the checks the
archive enforces. One repo means those can't drift apart behind version
pins. (It needs to become public so the workflows can use it — arguably
overdue anyway, since the gate authors are subject to should be
inspectable.)

**The archive repo** (`lax-db`, which already exists as our public mirror)
holds only data: one folder per submission with its record and check
results. No logic beyond thin workflow stubs that call into the code repo
at a pinned version. Branch protection so that only our GitHub App — our
automation identity — can write to it. Humans never push; moderation or
correction is a normal, visible commit by the App.

There is deliberately no third "pipeline" or "website" repo. The
separation between untrusted checking and trusted writing is real and
essential — but on GitHub Actions it is enforced by *how workflows are
triggered and what secrets they can see* (next section), not by repo
boundaries. A separate repo would add version-coordination overhead
without adding any guarantee.

## How a submission flows

A submission becomes **a pull request to the archive repo** (the CLI
automates creating it — authors won't do git surgery by hand). Two jobs
run, and the distinction between them is the heart of the design:

**1. The check job (untrusted, runs on the PR).** It runs the full
pipeline: validate the submission, compile the author's Lean code, re-check
the compiled proofs with the independent proof checker, and extract what
the site will display. Its purpose is *feedback*: the author sees pass/fail
and the reasons as ordinary PR checks.

Crucially, GitHub runs PR-triggered jobs with **no secrets and no write
access, by platform guarantee** — because a PR author fully controls what
such a job executes (they can even edit the workflow file in their branch).
So we treat everything this job produces as a *claim*, not a result. The
only thing carried forward is the compiled artifacts it uploads.

**2. The promote job (trusted, runs from our workflow definition, holds
the write credentials).** Triggered when the check job finishes, but it
executes *our* code from the main branch — the PR can't touch it. It takes
the uploaded compiled artifacts as untrusted input and independently
re-runs every check whose result the archive will assert: validation,
proof re-checking against our own trusted copy of the dependencies, and
extraction of the displayed content. The one thing it never does is
compile author code. It doesn't need to: compilation only *produces*
artifacts, and the checks *judge* artifacts — the proof checker tells us
whether these artifacts are kernel-valid regardless of who made them or
how. If everything passes, the job commits the record to the archive repo
and closes the PR.

This is the same trust principle the server applies today ("never trust a
result you didn't establish yourself"), relocated: the verification moves
to wherever the write credentials live.

## The pipeline in one view, and why compile is special

For those who know the pipeline only vaguely: a submission passes through a
fixed sequence of phases. The same code implements them everywhere — the
author's local CLI, the check job, the promote job — which is the point of
the monorepo. What differs per environment is only which phases run and
whether their results are treated as authoritative.

| Phase | What it does | Runs author code? | Check job (PR) | Promote job (trusted) |
|---|---|---|---|---|
| Validate | submission files and manifest are well-formed | no | runs | re-runs |
| Resolve | declared dependencies exist in the archive and the rules hold | no | runs | re-runs |
| Prepare | set up a build workspace with our pre-built, pinned dependencies | no | runs | not needed |
| **Compile** | **build the author's Lean code** | **yes** | runs | **never** |
| Re-check | an independent proof checker verifies the compiled proofs against our own trusted dependency copies | no — reads artifacts | runs | re-runs |
| Extract | pull out what the archive will assert and display (statements, concepts) | no — reads artifacts | runs | re-runs |
| Emit | assemble the final record and check results | no | runs | re-runs |

The asymmetry is safe because of what each phase *is*: compile **produces**
artifacts, every other phase **judges** them. The proof checker does not
care who produced an artifact or how — it re-establishes validity from
scratch against dependency copies we fetched ourselves, and the extraction
phase reads the artifacts, never the author's claims about them. So the
promote job can independently establish every fact the archive publishes
while never executing author-controlled code: it takes the compiled
artifacts the check job uploaded — assuming nothing about them, a
malicious artifact is exactly the input these phases exist to handle — and
re-runs the judging phases itself. (As defense in depth, the phases that
read author-produced artifacts run contained even in the promote job: no
network, minimal filesystem view.)

Put differently: the check job computes a *preview* on a machine the
author controls; the promote job computes the *truth* on a machine we
control, and compilation is the one step where the preview machine's work
— the artifacts — is carried across, precisely because it never has to be
trusted, only judged.

## Why a pull request, and not an issue or a direct trigger

We considered submitting via an issue, or having the CLI trigger a
workflow directly. The PR wins on three grounds:

- **Security by construction, not by discipline.** PR-triggered jobs get
  no secrets *because of the event type* — no configuration mistake, now
  or in any future edit, can leak credentials into the job that runs
  author code. Issue-triggered or directly-triggered workflows run
  privileged by default; keeping author code away from secrets there
  depends on us partitioning every job correctly, forever. For the
  security layer of the project, "the platform enforces it" beats "we
  remembered to".
- **An immutable record of what was checked.** A PR pins an exact commit;
  the checks attach to it and the submitted input survives permanently in
  git. An issue body can be edited after validation ran or deleted
  entirely. For an archive, provenance you can't rewrite is on-brand.
- **Free workflow machinery.** Required checks as the acceptance gate, a
  built-in approval gate for first-time contributors (someone has to wave
  through a stranger's first run before it consumes hours of compute),
  and a natural accept/reject lifecycle. The issue flow rebuilds all of
  that out of bot comments.

The cost is the fork-and-PR dance against a data repo, which is admittedly
ugly — but the CLI hides it entirely, and authors are in the CLI anyway.

## Reserving ids and changing ownership

Submitting is not the only way the archive changes. Two lighter operations
exist today as instant calls to the server, and both map onto the same PR
machinery:

- **Reserving an id.** A new submission starts by asking the archive for
  the next free sequential id (Lax1, Lax2, …), which creates a stub record
  owned by the requester — typically weeks before anything is submitted.
- **Changing the owner set.** Each record is owned by a *set* of GitHub
  users; owners can add or remove others (never themselves), so
  submissions survive people moving on.

In the plan, **every archive mutation becomes a pull request, and the
promote job is the single writer for all of them**:

- A reservation PR expresses intent — "reserve an id for me" — and cannot
  name the id, because "next free" is only decided when the write happens.
  The promote job, which processes writes one at a time, assigns the
  number at commit time, and the CLI reports it back to the author. Races
  between two reservations dissolve: each gets its number at its turn in
  the queue. The cost is that reserving takes a minute or two instead of
  a second — fine for something done once at the start of weeks of work.
- An ownership PR is self-describing: it edits the record's owner list,
  and the promote job enforces the same rules as today (only a current
  owner may change the set, the set stays non-empty, you cannot remove
  yourself). A nice side effect: ownership changes become visible events —
  the incoming owner can be mentioned and notified right on the PR —
  rather than silent database writes.
- In every case, the author's PR itself is never merged. The promote job
  validates the request, writes the canonical result as its own commit,
  and closes the PR. The archive's history therefore consists purely of
  automation commits, each traceable to the validated request that caused
  it.

Two simplifications fall out. Identity: today the server verifies tokens
against GitHub to learn who is calling; in the PR world GitHub
authenticates the actor for us — the PR author simply *is* the identity,
matched against the record's owner list. And the permission list of who
may submit at all stops being a private database on the server and becomes
a file changed by ordinary maintainer PRs — auditable like everything
else.

Note that reservation and ownership PRs execute no author code — their
check stage is a trivial format validation. They ride the same
PR → check → promote chain for uniformity and provenance, not because
they are dangerous.

## The website: explicitly a low-stakes decision

Flagging this clearly: **where the website is served from is an
implementation detail, and it should not absorb much of our discussion.**
The valuable and interesting part of this plan is the submission and trust
architecture above; the site is a static-site generator reading the
archive repo, and every serving option is cheap to build and cheap to
switch later.

The two obvious options, either of which is fine:

- **GitHub Pages**: a workflow regenerates the site when the archive repo
  changes and deploys it. Zero servers; the cost is that any future
  dynamic feature (e.g. comment sections) needs a small serverless
  component on the side.
- **Keep a small box**: it pulls the archive repo on a webhook, regenerates
  locally, serves the result. One pet server to maintain (much smaller
  than today's, since the dangerous builds are gone); dynamic features
  stay ordinary server code.

Both keep the same generator and the same data source. If we can't decide,
we pick one and move on; switching later is roughly one workflow of work.

## Practical points to settle (none block the architecture)

- **Mathlib distribution to runners.** Every check needs our pre-built
  mathlib (~7.5 GB). Plan: package it once, keyed by the pinned toolchain
  and mathlib version, rebuild only when the pins change, download per
  job. Runner disk and download time need one spike to validate.
- **Runner sizing.** The proof re-checking is the memory-hungry phase and
  now runs in the promote job on every accepted submission; the standard
  4-core/16 GB runners match what our box uses today, but this needs
  measuring, not assuming. (It also runs twice per submission — once for
  author feedback, once for the authoritative check. If compute ever
  pinches, the feedback-side run is the optional one.)
- **Where bulky build outputs live long-term.** The archive repo holds the
  small records; the full compiled artifacts need a home if we want to
  keep serving them (release assets on the archive repo, or a decision
  that we don't serve them).
- **Making the code repo public.**

## Rollout, in safe stages

1. **Shadow mode.** The check job runs on PRs with zero write access
   anywhere. We push our existing flagship submissions through it and
   compare against the server's results. This is where the practical
   unknowns (disk, memory, mathlib download) surface cheaply.
2. **Trusted promote in parallel.** The App starts committing, but the
   server remains the authority; we compare outputs for a while.
3. **Flip.** The archive repo becomes the source of truth, the CLI
   switches to the PR flow, and the server either shrinks to serving the
   website or retires, per the (low-stakes) website decision.

Each stage is independently reversible, and the lesson from the last
migration applies: nothing counts as working until it has actually run.
