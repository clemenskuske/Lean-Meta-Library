# Vision

The archive shall serve as the social and archival layer for automated Lean
formalization.

**Social:** Lean's kernel checks proofs for free, but it cannot check whether
a formal statement means what it claims to mean. The archive aims to provide the
missing trust: reviewers can publicly endorse formalizations as faithful,
staking their names on them. 

**Archival:** what arXiv is to preprints, the archive shall be to formalized
mathematics: a decentralized network of independent citable submissions
building on top of each other.

This document describes an absolutely minimal version of this product.
Everything non-essential is postponed to later. At the same time, we try to get
those things right that cannot be easily changed later.


## Concepts and Proofs

The archive's content comes in two kinds.

A **concept** pairs a well-defined mathematical object presented in natural
language (a definition or claim as it would appear in a paper),
with a faithful encoding of that object in Lean. Crucially, concepts contain no
proofs: they carry exactly the information needed to pin down the semantics of
a natural-language statement or definition within Lean, and nothing more.
Concepts are especially clean Lean code written for and in collaboration with
humans.

A **proof** is ordinary Lean code certifying a claim made by a concept. Since
the kernel checks its correctness, writing proofs can be outsourced entirely
to AI agents without compromising trust.

A **submission** is a single citable unit of work containing concepts and
proofs. The two are decoupled: a submission may leave its own proof
obligations open, and may discharge obligations of other submissions.


## Versioning

Unlike most software projects where code freely changes over time, submissions
are frozen in time. This makes it possible to build upon and cite previous
submissions, allowing the organic growth of a dependency network mirroring that
of scientific publications. We understand that this brings along its own
problems, which we believe are worth it. In particular, we pin the version of
Lean, Lake and mathlib.



# Submission Layout

This section gives the full rule set that all submissions in the archive must
adhere to.

Each submission carries two central files in the root folder:
``manifest.yaml``, written by the authors, and ``build-output.json``, derived by
the build.

## Archive Environment

We fix the following **archive environment**:

- ``specVersion: "1"``
- pinned Lean toolchain: ``leanprover/lean4:v4.30.0`` (the verbatim content
  of every ``lean-toolchain`` file; it also fixes the Lake version)
- trusted background imports
    - mathlib, pinned to revision ``c5ea00351c28e24afc9f0f84379aa41082b1188f``
- ``enableArtifactCache`` on
- concept build options
    - ``autoImplicit`` off
- proof build options
    - ``autoImplicit`` on
- allowed background axioms
    - ``propext``
    - ``Classical.choice``
    - ``Quot.sound``


## File Structure

A submission rooted at folder ``mysubmission`` with id ``Lax261`` **must**
have the following layout.

    mysubmission/
      manifest.yaml
      abstract.md
      LICENSE
      concepts/                    
        lakefile.toml
        lean-toolchain
        Lax261.lean                -- root module of the concept package
        Lax261/...                 -- modules of the concept package
      proofs/                      
        lakefile.toml
        lean-toolchain
        Lax261Proofs.lean          -- root module of the proof package
        Lax261Proofs/...           -- modules of the proof package

Additional Rules:

- **License.** The file ``LICENSE`` in the submission root folder must contain
  an accepted license, matched against the canonical text after whitespace
  normalization. An optional copyright line at the end of the file is
  ignored. For the MVP we accept exactly one license: the **Apache License
  2.0**, the license of Lean and mathlib.

- **Abstract.** ``abstract.md`` must be non-empty. It is rendered as markdown
  and shown prominently on the website.

- **Files.** ``build-output.json`` and ``lake-manifest.json`` must not be
  checked in. A local build leaving the files behind is fine. Files beyond the
  pictured layout (a README, etc) are allowed and ignored by the archive.

## manifest.yaml

The file ``manifest.yaml`` must contain the following keys and adhere to the following rules.

- ``specVersion``: version of the spec this submission adheres to
- ``mathlibVersion``: version the submission was built against
- ``leanVersion``: version the submission was built against

- ``id``: The archive-assigned unique id. It must be of the form ``LaxN`` for
  a positive natural number N written without leading zeros. Ids are
  deliberately opaque; this prevents the squatting of nice names like
  ``RamseyTheory``.

- ``title``: A non-unique title, like the title of the paper the submission formalizes.

- ``authors``: An ordered, possibly empty, list of author entries. Each entry is a
  tuple with a required ``name`` (display name) and optional ``orcid`` and
  ``github`` identifiers. Used for credit only, not rights-management.

- ``bibEntries``: a possibly empty list of strings, each a single BibTeX
  entry verbatim, as it would appear in a ``.bib`` file.

Additional Rules:
- ``specVersion``, ``leanVersion``, ``mathlibVersion``: must match the
  archive environment for now. ``leanVersion`` holds the version tag
  (``v4.30.0``); the full toolchain name (``leanprover/lean4:v4.30.0``)
  appears only in the ``lean-toolchain`` files.
- No keys beyond the ones listed here are allowed.

Example:

    specVersion: "1"
    id: Lax261             
    leanVersion: "v4.30.0"
    mathlibVersion: "c5ea00351c28e24afc9f0f84379aa41082b1188f"
    title: My Submission
    authors:
      - name: Alice Smith
        orcid: "0000-0002-1825-0097"
        github: alice
      - name: Bob
        github: bob
    bibEntries: []



## Packages

Each submission ``Lax261`` contains two Lake packages: a **concept
package** ``Lax261`` containing its concepts and a **proof
package** ``Lax261Proofs`` containing its proofs.

We only allow ``lakefile.toml``, never ``lakefile.lean``, and enforce the
following rules:

- **Whitelisted keys only.** The file may contain exactly the keys shown in
  the examples below: ``name``, ``defaultTargets``, the archive environment's
  build options, ``[[require]]`` entries (exactly ``name``, ``git``, ``rev``,
  optionally ``subDir`` — or ``name`` and ``path`` for the proof package's
  own concept package), and one ``[[lean_lib]]`` (exactly ``name``).

- **Fixed names.** The package name and the name of the single ``lean_lib``
  are both ``Lax261`` in the concept package and both ``Lax261Proofs`` in
  the proof package. The lib is the only default target. With Lake's default
  layout, module files therefore live under ``Lax261/`` and
  ``Lax261Proofs/`` respectively.

- **Dependencies.** Besides mathlib, concept packages may require only
  concept packages; proof packages may require both concept and proof
  packages. We issue a warning whenever a proof package is required.
  Requiring mathlib is optional in both packages (it is often already
  present transitively); when required, it must be required under the name
  ``mathlib`` from its canonical URL, pinned to the archive-wide revision.
  Concept and proof packages of other submissions are added by pinning the
  full commit hash and subfolder of the submission's repository. Every such
  ``(git, rev, subDir)`` triple must resolve to a registered submission: a
  record with ``repository = git``, ``commit = rev``, and ``subDir`` equal
  to the record's ``folder`` joined with ``concepts`` or ``proofs``. Only
  exception: the proof package may require its own concept package via the
  relative path ``../concepts``.

- **Imports.** A module may import only modules of its own package, of Lean
  core (``Init``, ``Std``, ``Lean``), of mathlib, and of the packages its
  package requires. Modules of mathlib's own dependencies (``Batteries``,
  ``Aesop``, ``Qq``, …) are not importable; import the corresponding mathlib
  module instead. Enforcement is a prefix check on each module's imports as
  recorded in the built environment: by the fixed-names rule, every archive
  module name begins with its package name, so an import's first component
  identifies its package. (An import of a module absent from the workspace
  never reaches this check — it already fails Compile.)

- **Root modules.** Each package has a root module: ``concepts/Lax261.lean`` in
  the concept package, ``proofs/Lax261Proofs.lean`` in the proof package. The
  build environment enforces that it contains all the modules of the package,
  and one ``import`` line per module, nothing else.

- **Empty submission.** A submission may contain no concepts and no proofs.

- **Pinned toolchain.** ``lean-toolchain`` must contain the archive-wide
  toolchain verbatim.

- **Builds.** Both packages must build: ``lake build`` succeeds in
  ``concepts/`` and in ``proofs/``. Lean warnings do not fail a submission.

Example ``lakefile.toml`` of a concept package:

    # mysubmission/concepts/lakefile.toml
    name = "Lax261"
    defaultTargets = ["Lax261"]
    enableArtifactCache = true

    [leanOptions]
    autoImplicit = false

    [[require]]
    name = "mathlib"
    git = "https://github.com/leanprover-community/mathlib4"
    rev = "c5ea00351c28e24afc9f0f84379aa41082b1188f"   # archive-wide pin

    # concept package of another submission this one builds on
    [[require]]
    name = "Lax42"
    git = "https://github.com/alice/othersubmission"
    rev = "0123456789abcdef0123456789abcdef01234567"
    subDir = "concepts"

    [[lean_lib]]
    name = "Lax261"

Example ``lakefile.toml`` of the corresponding proof package:

    # mysubmission/proofs/lakefile.toml
    name = "Lax261Proofs"
    defaultTargets = ["Lax261Proofs"]
    enableArtifactCache = true

    [leanOptions]
    autoImplicit = true

    [[require]]
    name = "Lax261"
    path = "../concepts"

    # discouraged, but allowed: reusing another submission's proofs
    [[require]]
    name = "Lax42Proofs"
    git = "https://github.com/alice/othersubmission"
    rev = "0123456789abcdef0123456789abcdef01234567"
    subDir = "proofs"

    [[lean_lib]]
    name = "Lax261Proofs"

## Namespaces

Each submission with id ``Lax261`` owns two top-level namespaces: its concepts 
live in ``Lax261`` and its proofs in ``Lax261Proofs``. 

## Concepts

A **concept** is a Lean module of the concept package; every module except the
root module is one, and must carry the concept annotation (see Annotations).
The concept ``Myconcept`` of submission ``Lax261`` is the module
``Lax261.Myconcept``, stored at Lake's canonical path
``concepts/Lax261/Myconcept.lean``. Concepts cannot be nested in subfolders.

The **statements** of a concept are the axioms whose module of origin it is.

A concept owns its module name as a namespace: every name the module declares
carries the module name as a prefix, e.g. ``Lax261.Myconcept.Ramsey``. This
one prefix condition is the whole rule — deeper subnamespaces are
automatically fine.

A concept may import mathlib modules and other concept modules (of the same
or of other submissions). These imports form the **concept DAG** (acyclic for
free, since Lean imports are).

Additional Rules:

- **Axiom-free.** The axiom set (``#print axioms``) of every declaration of
  the concept package may contain only the archive environment's background
  axioms — plus, for a statement, the statement itself, which an axiom always
  reports. No other statement may occur: concepts declare statements but
  never use them, so no concept builds on an unproven claim.

## Proofs

A **proof** is a declaration of the proof package whose docstring carries
yaml frontmatter (see Annotations); every other declaration is a helper,
which the archive ignores. Frontmatter is the opt-in: helpers may carry
ordinary docstrings, and any mistake in a frontmatter — an unrecognized key,
a missing ``conclusion``, a declaration of the wrong kind beneath it — is a
loud build error, never a silently ignored proof.

The frontmatter's ``conclusion`` key names the proof's **conclusion**, the
statement it discharges. Its **assumptions** are the statements in its axiom
set (``#print axioms``).

Rules:

- **Theorem kind.** A proof must be of theorem kind — the kernel's notion,
  not the surface syntax, so mathlib's ``lemma`` qualifies.

- **Conclusion.** The ``conclusion`` id resolves to a statement of a concept
  package the proof package requires, present in the proof's environment —
  i.e. the proof's module (transitively) imports the concept module
  declaring it. The proof's type is definitionally equal to the statement's
  type (kernel check).

- **Assumptions cross-check.** The optional ``assumptions`` key, when
  present, must equal the computed assumption set — a redundant sanity
  check for authors, not an input.

- **Axiom hygiene.** Every axiom in the axiom set of any declaration of the
  proof package — proof or helper — is a background axiom or a statement of
  a required concept package. Statements of packages that are only
  transitively reachable do not qualify: to assume a statement, require its
  package.

- **Namespace.** Every name declared in the proof package carries the
  prefix ``Lax261Proofs``, as for concepts.

Together, the proofs weave the statements of the archive into the **proof
network**: the directed hypergraph over all statements with a hyperedge
(A → c) for every proof with assumption set A and conclusion c. A statement
is **proven** if it is the conclusion of some proof all of whose assumptions
are (recursively) proven, and **unproven** otherwise — a least fixed point,
so statements in a dependency cycle do not prove each other. More generally, a
statement is **proven relative to** a set C of statements if it becomes
proven once the statements in C are taken as proven.

## Annotations

We annotate concepts and proofs. A concept is annotated by its module docstring
``/-! … -/``, of which we allow at most one per module. A proof is annotated by
the usual docstring ``/-- … -/``.

Each annotation is a docstring that we parse as markdown with yaml frontmatter
(a common pattern from static site generators). When later parsing this
docstring into key-value pairs, the markdown after the frontmatter is placed
into the ``description`` key. The frontmatter grammar is a fixed minimal
subset of yaml — scalar ``key: value`` lines, plus a plain list of names for
``assumptions`` — because it is parsed by the inspector in core-only Lean
(see Inspection Scaffolding); anything beyond the subset is a build error,
never a guess. The recognized keys (the list may later be
extended):

Concept
    - ``title`` (required): natural-language name of the mathematical object,
      like "Ramsey's Theorem"
    - ``description`` (required): the natural-language description of that
      object. The whole validity of the archive rests on the assumption that
      the Lean side of the concept faithfully represents this description.

Proof
    - ``conclusion`` (required)
    - ``assumptions`` (optional): a yaml list of fully qualified statement
      names, see Proofs
    - ``description`` (optional): additional information, like attribution or
      the high-level idea.

Frontmatter with an unrecognized key leads to build errors.

An example concept module ``concepts/Lax261/Myconcept.lean``:

    import Mathlib.Combinatorics.SimpleGraph.Basic
    import Lax42.Colorings

    /-!
    ---
    title: Title of the concept
    ---
    description of the concept
    -/

    namespace Lax261.Myconcept

    /-- an ordinary Lean docstring; no frontmatter -/
    axiom X [...]

    [...]

    end Lax261.Myconcept


An example module within the proof package:

    import Lax261.Myconcept

    namespace Lax261Proofs

    /--
    ---
    conclusion: Lax261.Myconcept.X
    ---
    description of proof Q
    -/
    theorem Q ...

    end Lax261Proofs


# Archive Database

The archive stores one folder per allocated id. ``LaxN/record.json`` holds the
mutable lifecycle data: state, owner set, timestamps, the current (repository,
commit, folder) triple. ``LaxN/build-output.json`` holds the build output:
absent in the init state, overwritten on every draft submit (drafts are shown
on the website), frozen on registration. 

Example ``record.json``

    {
      "specVersion": "1",
      "id": "Lax261",
      "state": "registered",
      "createdAt": "2026-07-01T12:00:00Z",
      "registeredAt": "2026-07-19T09:30:00Z",
      "owners": [
        { "githubId": 583231, "handle": "alice" },
        { "githubId": 913874, "handle": "bob" }
      ],
      "source": {
        "repository": "https://github.com/alice/mysubmission",
        "commit": "0123456789abcdef0123456789abcdef01234567",
        "folder": "."
      }
    }

- ``owners``: GitHub accounts, non-empty, immutable after registration.
  Stored as numeric account id (handles are renameable) plus the handle for
  display.
- ``createdAt``, ``registeredAt``: UTC timestamps of init and registration;
  ``registeredAt`` is absent before registration.
- ``source``: the (repository, commit, folder) triple; absent in the init
  state, frozen on registration.



Example of ``build-output.json``

    {
      "specVersion": "1",
      "id": "Lax261",
      "manifest": { ... },
      "requiredByConcepts": ["Lax42"],
      "requiredByProofs": ["Lax42", "Lax42Proofs"],
      "concepts": [ ... ],
      "proofs": [ ... ]
    }

- ``manifest``: the parsed content of ``manifest.yaml``.
- ``requiredByConcepts`` lists all packages required by the concept package,
  and ``requiredByProofs`` lists the packages required by the proofs package.

Each entry of ``concepts``:

    {
      "id": "Lax261.Myconcept",
      "path": "concepts/Lax261/Myconcept.lean",
      "title": "...",
      "description": "...",
      "imports": ["Lax42.Colorings"],
      "sourceText": "...",
      "statements": [
        {
          "id": "Lax261.Myconcept.X",
          "signature": "X : ..."
        }
      ]
    }

``title`` and ``description`` come from the concept annotation, where both are
required. ``imports`` lists imported concept modules only — mathlib imports are
dropped. ``sourceText`` is the verbatim file content, so the website can
display concept code without access to the repository. ``statements`` lists the
concept's axioms with their pretty-printed types; the website marks each proven
or unproven.

Each entry of ``proofs``:

    {
      "id": "Lax261Proofs.Q",
      "path": "proofs/Lax261Proofs/Basic.lean",
      "conclusion": "Lax261.Myconcept.X",
      "assumptions": ["Lax42.Colorings.Somestatement"],
      "description": "..."
    }

``assumptions`` is always the pipeline-computed set, regardless of whether the
author supplied the redundant ``assumptions`` key. Proof entries carry no
``sourceText``: the website lists proofs, it does not display their code.

The file is deterministic: every list is sorted lexicographically, concepts,
statements and proofs by ``id`` and the rest by value.


# The Archival Layer

An **owner** is a GitHub account listed in a submission's owner set, and is
thereby allowed to act on the submission (e.g., submitting and editing).
Owners act on the archival layer.

The archive does not host submissions, it references them: a submission is a
folder together with a commit hash in a public git repository. Work thus stays
in the authors' repositories and attribution is clear. (To guard against link
rot, we may later keep backup copies, e.g. via
https://archive.softwareheritage.org/save/.)

## Lifecycle

Submissions can be in three possible states within our database.

**init:** an id and owner set have been allocated for this submission, but
nothing has been uploaded yet.

**draft:** visible on the website, overwritable by its owners, not citable,
not reviewable, and not allowed to be used in downstream submissions.

**registered:** immutable, citable, reviewable. The normal published state.

The only state transitions are:

- ``-> init``,
- ``init -> draft``
- ``init -> registered``
- ``draft -> draft``
- ``draft -> registered``

## Actions

Every archive action happens via our CLI tool. It has three write actions:
``init`` allocates an id, ``submit`` uploads or registers content, and
``set-owners`` edits the owner set.

**Init.** ``lax init`` takes an empty local folder. The archive reserves the
next free id ``LaxN`` and creates a record in the init state whose
owner set contains exactly the authenticated GitHub account. The CLI then
scaffolds the complete submission layout for that id (see CLI).

**Set-owners.** ``lax set-owners`` replaces the owner set of a submission in
the init or draft state. The authenticated GitHub account must be in the
current owner set and may not remove itself. The owner set becomes immutable on
registration.

**Submit.** ``lax submit`` hands the archive a (repository, commit, folder)
triple. The folder must contain a complete valid manifest whose ``id`` equals
the id of the record being submitted to. That record must be in the init or
draft state, and the authenticated GitHub account must occur in its stored
owner set.

- Without ``--register``, a successful submit puts the submission in the
  draft state and replaces its previous (repository, commit, folder) triple
  and mutable manifest metadata.
- With ``--register``, a successful submit registers the submission and
  freezes its triple, manifest, concepts, and proofs.





# Implementation

- The **build pipeline** checks a submission against this spec and derives its
  ``build-output.json``. It is the sole authority on what this spec means.

- The **site generator** turns the database into the website.

- The **database repository** holds the archive's state.

- The **CLI** ``lax`` is the only thing authors and agents ever touch.

- The **archive server** is the archive's single piece of infrastructure. It
  serves a small HTTPS API to the CLI, runs build pipeline and site generator
  centrally, and is the sole writer of the database repository.

## The Built Environment: A Primer

The target audience for this spec are graph theory reserachers with no deep
familiarity with Lean. This section therefore sets up necessary background:
what the environment is, and why the inspector reads it instead of the source.

**The environment.** Compiling a Lean module elaborates its source: notation
is expanded, implicit arguments are filled in, tactics are run, and the
result is a set of **declarations** — constants, each with a fully qualified
name, a kind (definition, theorem, axiom, …), a type, and, except for
axioms, a value — all checked by the kernel. The environment is the map from
names to these declarations. Each module persists its declarations into its
``.olean`` file, and importing a module loads them back; imports are
transitive, so the environment the inspector sees contains every declaration of
every module beneath it — the package's own, other submissions', mathlib's,
core's. Two properties make it the right thing to inspect. First, every
declaration records its **module of origin**, and each ``.olean`` lists
exactly the constants its module contributed — so "the declarations of this
package" is a lookup, not a search through mathlib's hundred thousand
constants. Second, values are stored, so walking a declaration's type and
value transitively reaches every constant it uses — that walk
(``Lean.collectAxioms``) is how axiom sets are computed.

**Elaboration is many-to-many.** One source command can produce many
declarations, or none. A ``structure`` generates its constructor, recursor,
projections, and helper lemmas (``mk.injEq``, ``mk.sizeOf_spec``); a pattern
match compiles into auxiliary ``match_1`` functions; ``example`` produces
nothing at all. Conversely, the surface syntax is gone: the environment no
longer knows whether a definition was written as ``def``, ``abbrev``, or
``instance``. This is why every unit the archive cares about is defined as
an environment notion — a statement is an axiom, theorem-ness is the
kernel's kind, docstrings are persisted data — and why rules that only the
surface syntax could decide were dropped (see Decisions). The generated
declarations are harmless throughout: they carry no docstrings (so they are
never proofs), their axiom sets are empty or background, and their names
extend the parent declaration's name.

**User-level and internal names.** Lean itself distinguishes the names an
author declared from its own bookkeeping, and exposes that boundary as data.
``private`` declarations are stored under a mangled name
(``_private.<module>.0.<real name>``), and ``privateToUserName?`` inverts the
mangling exactly. Machine-generated auxiliaries carry names that
``Name.isInternalDetail`` recognizes. This is the same boundary Lean's
documentation tooling uses to list "the declarations of a module", and the
inspector adopts it wholesale rather than inventing its own. Rules that
quantify over "every name a module declares" mean user-level names in exactly
this sense.

## Build Pipeline

The pipeline operates directly on the submission folder. There are no shadow
workspaces and no third lakefile: the two packages are the only workspaces.

It runs multiple phases. Violations are collected, not failed fast, so the final
report lists every violated rule. A phase with violations aborts the
subsequent phases.

- **Static validation** (milliseconds, no network): folder layout, license,
  ``abstract.md``, manifest schema, ``lean-toolchain``, the lakefile whitelist
  of the Packages section, and that no generated file is tracked by
  git — when the folder is not inside a git repository, this check is skipped
  with a warning. This phase also derives each package's **module
  inventory**: the root module plus one module per ``.lean`` file under
  the package's module folder, read off the file paths via Lake's
  canonical mapping (``Lax261/Foo/Bar.lean`` is ``Lax261.Foo.Bar``). The
  inventory is the pipeline's sole answer to "which modules does this
  package contain": Replay's target list and Inspect's import list are
  taken from it, never rediscovered from build artifacts — those are
  written by Compile, i.e. by attacker code. The import-related checks
  (the import rule, root-module exactness) are deliberately not here:
  imports are taken from the built environment and judged at Inspect, so
  the pipeline never parses source.

- **Resolution** (milliseconds, no network): Check that every dependency triple
  resolves to a registered submission (via ``~/.lax/db`` locally, via local
  checkout on server). A local miss may just mean a stale database, so the
  CLI suggests ``lax pull-db`` and a retry before reporting the violation.

- **Compile:** ``lake build`` in ``concepts/`` first, then in ``proofs/``. When
  the concepts build fails, the proofs build is skipped. Compile is the
  pipeline's only networked phase: it fetches the pinned git dependencies,
  pulls prebuilt artifacts into Lake's machine-wide shared artifact cache — so
  mathlib is downloaded, or at worst built, once per machine, not once per
  submission — and on a fresh machine first downloads the pinned toolchain via
  ``elan``. A failing build is a violation of the Packages section's build
  rule; the build transcript is reprinted to stdout so the user can act on it.
  (On the server, the cache is the trusted artifact store, read-only to the
  build; see Archive Server.)

- **Replay:** re-check every declaration of the submission's two packages
  with ``leanchecker``, the kernel checker that ships inside the pinned
  toolchain — shelled out to, not reimplemented. In each package folder
  the checker runs once per module of the package's inventory, root
  module included: ``lake env leanchecker <module>``. Its default mode
  checks the named module against its imported environment; the imports
  themselves are not replayed (that would be ``--fresh``, which we do not
  use). Enumerating the inventory is load-bearing twice over. First,
  because the checker trusts imports, naming only the root — which
  declares nothing — would replay nothing at all while appearing to
  succeed. Second, the target list comes from Static validation's
  file-derived inventory, never from the root's recorded imports or
  anything else Compile wrote — otherwise the attacker who wrote the
  artifacts would choose what gets checked. A module of the inventory
  with no artifact in the workspace is a violation (usually the trace of
  a root module that fails to import it). Trusting the imports is sound
  only by provenance: mathlib and core are the pinned, trusted background, and
  the packages of other submissions were replayed at their own
  registration — provided the oleans in the workspace are really those.
  Locally the workspace is taken at its word; on the server, whose run
  alone gates registration, Replay and Inspect never read a dependency
  artifact Compile produced but only artifacts provisioned from the
  trusted store (see Archive Server). Replay exists because Compile ran
  arbitrary submission code, which can persist declarations the kernel
  never checked (``set_option debug.skipKernelTC``, unchecked environment
  APIs); replay closes exactly that hole. What no replay mode can do is
  authenticate imports: an axiom is kernel-valid whatever its type, so
  even ``--fresh`` cannot tell a forged upstream statement from the
  registered one (see Decisions) — hence provisioning.

- **Inspect:** extract environment facts with the ``Lax.Inspector``
  executable, then judge every remaining rule in the CLI — including the
  import rule and root-module exactness — see below.

- **Emit:** write ``build-output.json`` into the root of the submission.

Compile, Replay, and Inspect form a trust chain. Compile is where untrusted
code runs; nothing it outputs is trustworthy on its own, because the
submission's own elaboration wrote it. Replay authenticates the oleans'
kernel-level content relative to their imports — every declaration
type-checks against the imported environment — and no more; Inspect
reports what the oleans say; the CLI decides whether that is admissible.
The imports themselves the chain cannot authenticate, only inherit: on the
server they are provisioned from the trusted artifact store (see Archive
Server), so the background Replay checks against is the one registration
once checked.

The inspector's facts accordingly carry two grades of trust.
**Kernel-grade:** kinds, types, values, and everything recomputed from them
— axiom sets, defeq — which Replay makes impossible to forge within the
submission's own packages; for imported packages the same facts are
authentic by provisioning, not by replay.
**Metadata-grade:** import lists, constant-list membership, docstrings —
artifact data a malicious Compile could in principle fabricate. The rules
lean on metadata only where forgery cannot make a false thing true:
docstrings are authored content anyway, a forged import list can hide at
worst an editorial violation, and every cross-package claim is checked
against the database, never against the workspace (see Inspection
Internals). Source-structural facts — layout, lakefiles, manifest — never
pass through the oleans at all; the CLI reads the files directly. The chain
bottoms out where the archive's trust always bottoms out: Lean's kernel,
the pinned mathlib revision, and the server's custody of the artifacts
beneath the submission.


### Inspection Scaffolding

All archive-side meta-programming lives in ``Lax.Inspector``, a Lean
package providing one executable: pinned to the archive toolchain,
importing only Lean core, never mathlib. (Replay needs no counterpart —
``leanchecker`` ships inside the toolchain itself.) The inspector's source
ships with the CLI; the first ``lax build`` on a machine compiles it into
``~/.lax/tools/<cli-version>/`` and every later run of that CLI version
reuses it — the version in the path is what makes an upgraded CLI recompile
instead of running a stale binary.

An executable, never an elaborated command: the inspector loads the
package's oleans directly and executes no code originating outside its own
binary and Lean core. Importing a module must not run its ``initialize``
blocks — arbitrary interpreted IO — and nothing imported may be evaluated,
because once untrusted code runs in the inspecting process, nothing that
process writes is authentic (see Decisions). What remains is enough:
docstrings, module docs, and constant lists are persisted data readable
through core's built-in machinery, axiom walks are pure traversals, and
defeq is kernel reduction, not interpretation.

The boundary between inspector and CLI is drawn by capability: the inspector computes
exactly the facts the CLI cannot — everything whose evaluation needs the
loaded environment or the kernel — and the CLI, which alone holds the
archive context (the verified ``[[require]]`` set, the manifest, the
database), judges every rule. The inspector decides nothing about validity:
a failed defeq or a malformed frontmatter appears in the report as a fact
and becomes a violation only in the CLI, the sole emitter of violations.

One placement follows from this and deserves its reason spelled out:
frontmatter is parsed by the inspector, not the CLI. The kernel facts about
a proof — does its ``conclusion`` resolve, does defeq hold — are indexed by
a name that sits inside its docstring's frontmatter, so whoever parses the
frontmatter determines the number of passes over the environment: parsing
in the CLI would force a second inspector run to feed the names back in.
Parsing in the
inspector keeps inspection single-pass, and the report carries structured
annotations rather than raw docstrings, so the frontmatter grammar (see
Annotations) is implemented exactly once.

Inspection runs once per package: the executable is invoked under ``lake
env`` with the package's module inventory (see Static validation) and an
output path as its arguments. ``lake env`` supplies the workspace's search
path without executing user code — the lakefile.toml-only rule is
load-bearing here. The executable imports the inventory's modules with
initializer execution disabled, inspects the resulting environment, and
writes one JSON report to the output path. Importing the inventory rather
than the root module anchors coverage to the file tree: a module the root
fails to import is still inspected — and convicts the root — instead of
silently dropping out of the environment. Statement
signatures are pretty-printed with core notation only: delaborators and
unexpanders are imported code, and running mathlib's would mean running the
submission's too (the recorded upgrade path is in Decisions). The report
contains:

- per module of the package: its direct imports as recorded in the
  environment header — this is where all import data in the pipeline comes
  from — and its module docstrings, frontmatter-parsed into annotations
  (parse problems are reported as facts like everything else);

- per declaration whose module of origin lies in the package: name, kind,
  module of origin, axiom set, whether the name is user-level (internal
  details flagged, private names un-mangled), and its docstring parsed the
  same way;

- per declaration whose frontmatter carries a ``conclusion``, the kernel
  facts: whether the name resolves, whether it names an axiom and from
  which module, whether that module lies among the transitive imports of
  the declaration's own module, and whether the declaration's type is
  definitionally equal to the statement's type;

- the pretty-printed types of the package's axioms.

The report is a pure function of the workspace's oleans, the module
inventory, and the inspector version: the inventory comes from the file
tree, and no archive context flows into the invocation, so the same built
workspace always yields the same report.

### Inspection Internals

The primer supplies every notion the pipeline needs; this subsection spells
out how each check reduces to a CLI-side judgment over the reported facts.

**One enumeration.** The inspector considers exactly the declarations whose
module of origin lies in the package under inspection, taken from the
modules' own constant lists. This includes everything elaboration generated
on the package's behalf — helper lemmas, matchers, even lemmas Lean realizes
on demand for *imported* constants (equation lemmas of a mathlib definition,
say), should Lean attribute those to the realizing package. Nothing is
exempted: generated declarations satisfy every rule on their own, as the
primer explains, so uniform treatment costs nothing.

**Axiom checks are set comparisons.** The spec phrases its rules in terms of
``#print axioms`` because that is the familiar name; the inspector calls the
API behind the command (``Lean.collectAxioms``, the walk from the primer)
and reports the resulting set per declaration. Every axiom rule is then, in
the CLI, one comparison against an allowed set — the only question is what
is allowed.

- In the concept run, the allowed set is the background axioms plus the
  declaration itself (an axiom always reports itself, see Axiom-free). No
  knowledge of other submissions is needed: statements never occur in
  concept axiom sets, so this run tells nothing apart.

- In the proof run, the allowed set is the background axioms plus the
  statements of required concept packages. An axiom counts as such a
  statement iff its module of origin lies in a required concept package — a
  prefix test of the module name against the package names whose
  ``[[require]]`` entries Resolution has just verified. Leaning on the
  fixed-names rule here is sound because every verified entry points at a
  registered submission, and registration enforced that rule on it. One
  cross-check guards the metadata: the axiom's name must also appear among
  the ``statements`` in that submission's registered ``build-output.json``
  — the database, not the workspace, is the authority on another
  submission's statements, so a forged module masquerading under a required
  package's name classifies as nothing. The name comparison alone would not
  survive a forgery that keeps the registered names and changes the types
  beneath them; it is sound because the upstream oleans themselves are
  authentic where the verdict counts — provisioned from the trusted store
  on the server (see Archive Server, Decisions).

Anything outside the allowed set is a violation. In the proof run this is
what catches a stray ``axiom`` in the proof package, an unexpected axiom
arriving through mathlib, or a statement used without requiring its package,
instead of silently counting any of them as an assumption.

**The namespace check.** Restrict the enumeration to user-level names — drop
the internal details, un-mangle the private names; the boundary from the
primer — and the check is a single prefix test: the module name for
concepts, the package name for proofs. Generated declarations pass because
their names extend their parent's; realized lemmas for imported constants
are internal details and drop out before the test; a declaration escaping
via ``_root_.`` fails, which is the point of the rule.

**The import rule and the root module.** The reported per-module imports
replace any reading of import lines from source. The import rule is a
prefix test in the CLI: an import's first component identifies its package
(the fixed-names rule), and the allowed set follows from the verified
``[[require]]`` entries. Root-module exactness is three facts from the same
report: the root module imports exactly the other modules of the inventory
(tolerating the implicit ``Init`` of an empty package), contributes no
declarations, and carries no module docstring. No separate file-tree
cross-check is needed: the inventory *is* the file tree, and Replay and
Inspect enumerate exactly it — a source file the root fails to pull in is
still replayed and inspected, and a root import naming a module outside
the inventory fails exactness directly.

**The proof checks.** A candidate proof arrives in the report with its
parsed frontmatter and its kernel facts, and the CLI adds the context: the
conclusion must name an axiom whose module lies in a required concept
package (the same prefix test as above) and be reachable through the proof
module's transitive imports, defeq must hold, the declaration must be of
theorem kind; the ``assumptions`` cross-check compares the frontmatter's
claim against the statements in the reported axiom set. Each fact that
comes back false is one violation.

**The pipeline never parses Lean.** Every unit the report contains is
environment data: a concept is a module, a statement is an axiom
(``ConstantInfo.axiomInfo``) from a concept module, theorem-ness is the
kernel's kind, imports are the environment header's module data, and the
annotations are persisted docstrings (``getModuleDoc?`` for modules,
``findDocString?`` for declarations). So proof-hood is data too: the
inspector spots frontmatter in a docstring by string inspection, not by
parsing Lean. No component of the pipeline reads source as Lean at all;
Emit copies files verbatim into ``sourceText``, which is a copy, not a
parse.


## Site Generator

The site generator is a static site builder: it reads the ``record.json`` and
``build-output.json`` of the database and emits pages. One per submission
(abstract, authors, bib entry, and its concepts with title, description, Lean
source, and statement signatures), one per concept, and index pages listing
submissions and browsing the concept DAG and the proof network, marking each
statement proven or unproven.


## Database Repository

The folder tree of the Archive Database section is the canonical state of the
archive; everything else (website, indexes) is derived. The database is a
single public git repository with a single writer — the archive server — and
every user holds a read-only clone of it at ``~/.lax/db``. The path is
deliberately visible, so AI agents can use it to survey existing submissions
and find prior work to build upon. Installing the CLI clones the repository.


## CLI

The acting GitHub account authenticates via GitHub OAuth (the CLI reuses an
existing ``gh`` login). ``lax`` has the following commands:

**lax init [folder]** (default ``.``) starts a submission, see Actions. The
folder must be empty or not yet exist; otherwise init refuses. The scaffold
comprises ``manifest.yaml`` (with ``id: LaxN`` and the environment pins),
package folders, lakefiles, ``lean-toolchain``, root modules, ``abstract.md``,
``LICENSE``, and a ``.gitignore`` covering ``build-output.json``,
``lake-manifest.json``, and ``.lake/``. Init warns when the folder is not
inside a git repository. The result passes ``lax build`` as an empty
submission.

**lax set-owners [folder] --new-list <handle>...** (default ``.``) replaces
the owner set with the given GitHub handles (resolved to numeric account ids,
see Archive Database), see Actions. The submission is identified by the ``id``
in the folder's ``manifest.yaml``.

**lax build [folder]** runs the build pipeline: it checks the submission
against this spec and on success writes ``build-output.json``. Any violation
fails with a nonzero exit and a report listing every violated rule.

**lax serve [folder]** runs the **site generator** and serves the result
locally. It is a long-running process that does not daemonize by default. It
watches both the local database and the submission folder for changes: the
submission's ``build-output.json``, and the ``record.json`` of registered
submissions. Every change triggers a website rebuild. The local folder is
rendered from its own ``build-output.json`` against a synthetic draft record,
so ``lax serve`` works before ``lax init`` has allocated an id. If
``build-output.json`` is missing, the website shows a placeholder stating that
the output has not been generated yet; ``lax serve`` does not build.

**lax submit [folder]** derives the (repository, commit, folder) triple from
the folder's git state — the remote URL, the HEAD commit, the folder's path
within the repository — and hands it to the archive. It refuses if the
worktree is dirty or HEAD is not present on the remote. Without
``--register`` it requests the draft state, with it registration; on success
the archive updates the record as described in Lifecycle.

**lax pull-db** refreshes the local database checkout at ``~/.lax/db``, see
Database Repository. It is read-only with respect to the archive and needs no authentication.

**lax update** upgrades the CLI itself to the latest release and then refreshes
the local database, see Distribution. Likewise needs no authentication.

**lax spec** prints this specification. The text is embedded in the binary at
build time, so the printed spec is exactly the one that binary enforces.
Useful for agents authoring submissions.


## Archive Server

One server does everything the archive does centrally: it answers the CLI's
write requests, owns the database repository, and puts the website online.

- **Authentication.** The CLI sends the user's GitHub OAuth token (reused
  from the ``gh`` login) with every write request. The server verifies the
  token against GitHub and resolves it to the numeric account id that all
  ownership checks run against.

- **Endpoints.** One per write action: ``POST /init``, ``POST /set-owners``,
  ``POST /submit`` (with a ``register`` flag), plus ``GET /jobs/<id>`` for
  polling a submit (see Async submit). These three write commands are the only
  ones that leave the user's machine. Reading *archive content* needs no server
  at all — it goes through the public database repository (``lax pull-db``);
  the server answers no content queries.

- **Build Pipeline.** Compile executes untrusted code (elaboration,
  import-time initializers) — not only the submission's own, but that of
  every upstream submission it imports. Replay and Inspect execute no
  untrusted code but consume attacker-shaped oleans, whose loading is
  unsafe deserialization. The server runs all three sandboxed. The sandbox
  protects the host, not the report: authenticity comes from the trust
  chain of the Build Pipeline section together with the trusted artifact
  store below, and a malformed olean is a crash and a failed build, not a
  compromise.

- **Trusted artifact store.** Everything Compile writes is suspect,
  including the dependency artifacts it fetched or built: code running
  inside the build can overwrite an upstream olean in place, and no replay
  can detect that (see Decisions). The server therefore never lets Replay
  or Inspect read a dependency artifact that Compile produced. It maintains
  a store of trusted artifacts with exactly two write paths: mathlib and
  core artifacts, fetched or built by the server itself against the archive
  pins; and the two packages of every submission, captured when its
  registration commits — right after its own Replay passed, which is
  precisely the moment those oleans are authenticated. Compile sees the
  store as a read-only artifact cache; whatever it writes lands in a
  scratch overlay discarded when it exits. Replay and Inspect then run in a
  workspace whose dependency artifacts are re-materialized from the store
  and whose only Compile-produced artifacts are the submission's own two
  packages — exactly the ones Replay checks. The store is complete by
  construction: Resolution admits only dependencies on registered
  submissions, and registration captured their artifacts.

- **Processing.** The server is the single writer, so a global lock over
  database writes suffices. Writes are short: validate the request
  (ownership, state), commit the updated ``record.json`` (and
  ``build-output.json``), push. The expensive part of a submit — cloning the
  triple and running the full sandboxed build pipeline — happens *outside*
  the lock, so one submit does not stall unrelated requests. The ownership
  and state checks are therefore re-run after acquiring the lock: the record
  may have moved while the build ran, and a build against a stale record must
  not be committed.

- **Async submit.** The pipeline takes minutes, so ``POST /submit`` returns
  a job id which the CLI polls until it receives success or the violation
  report.

- **Website.** After each push, the server runs the site generator and serves
  the result. Because the server is the writer, it never has to poll for
  changes: it knows exactly when the database moved.

## Distribution and Deployment

The CLI is the one component users install. We distribute via npm or similar,
making installs and updates one-liners, and expose the upgrade as ``lax
update`` so no user has to know which package manager we chose.

The CLI is not self-contained: it shells out to ``elan``/``lake`` (Compile;
building the inspector; Replay and Inspect run under ``lake env``), to
``git`` (the tracked-files check, ``lax submit``, and the database clone),
and to ``gh`` (the reused OAuth login). It checks for all
three on startup and names the missing one rather than failing inside a
subprocess. Installation clones the database (see Database Repository), which is
also the first ``lax pull-db``.

The CLI and the archive server are built from the same repository, which keeps
the pipeline that authors run locally and the pipeline that gates registration
the same build — and likewise the site generator that ``lax serve`` runs and
the one behind the website.


# The Social Layer (future work)

This section is reserved for future work and not part of this spec.

A **reviewer** is a verified ORCID identity (via OAuth) with a real-world name,
leading to trust by reputation. Reviewers act on the social layer.

## Endorsements and Flags

Reviewers can **endorse** and **flag** individual concepts. Both are public
verdicts staked on the reviewer's verified ORCID and performed explicitly on
the website — endorsement is opt-in, never implied by authorship.

**Endorsing** means signing the following attestation, displayed at the moment
of endorsement:

    I have read this concept's description and its Lean code, and I attest that
    the code faithfully formalizes the description.

    In particular, I have followed its dependencies — their descriptions, and
    their code — as deeply as necessary.


The endorser vouches for the meaning of the concept as a whole, including the
upstream context that meaning rests on. How deep to read upstream is the
endorser's judgment call — that judgment is exactly what they stake their name
on. Endorsements are revocable.

A **flag** is the opposite verdict and requires a message outlining the
problem. A flag is a staked claim, not a final verdict: it stands until the
flagger retracts it.



# Decisions

**Atoms.** *Resolved: removed. The concept is the only exposed unit.* An
earlier draft gave concepts a second layer: **atoms**, the individual
declarations introduced by the concept's declaration commands, each with its
own id, ``kind``, signature, and annotation. Identifying them required a walk
over the parsed source — the built environment cannot report which command
introduced a declaration, since it no longer distinguishes ``abbrev`` from
``def`` or ``instance`` from ``def`` (both attributes), and ``example``
leaves no trace at all — plus a match of that walk against the environment,
a ``namespace``/``end`` stack, ``mutual`` handling, ``_root_.`` handling, and
a rule forcing every concept instance to be named so the walk had a name to
record.

None of it was load-bearing. What the archive's mechanisms actually need
named individually is *statements*, because a proof's ``conclusion`` points
at one and the proof network is a graph over them — and a statement is an
axiom, which the environment reports honestly and exactly. The spec had in
fact been defining statements twice, once via atoms in the Concepts section
and once via module of origin in Inspection; only the second was ever
consulted. The two could even disagree, since an attribute can generate an
axiom that no declaration command introduces. Deleting atoms collapses them
into one definition and removes the divergence.

Everything else atoms bought was presentation: per-declaration titles,
descriptions, and signatures on the website. That loses real navigability for
a long concept, and we accept it for now on two grounds. The concept is
already the unit of trust everywhere else — the endorsement attestation is
written about a concept read whole, not about an atom — so the exposed
granularity now matches the endorsed granularity. And ``build-output.json``
is derived data, so reintroducing a per-declaration layer later breaks no
citation, no endorsement, and no stored record. This is the direction that is
safe to defer.

The concept-as-unit also puts the spec in line with our conclusion on
locality: the module-inclusion DAG is the semantics we are confident in, and
a dependency DAG over individual declarations is future work pending help
from someone who knows the elaborator deeply. Atoms were a half-step toward a
granularity we had already decided not to commit to.

**Concept dialect enforcement.** *Resolved: dropped for the MVP; the dialect
stays a rule, the parser goes.* Removing atoms left the re-parse with two
jobs: the command whitelist and the module docstring. The second turned out
not to need it — Lean persists module docstrings in the ``.olean`` and
``getModuleDoc?`` reads them back for imported modules, so annotations are
environment data like everything else.

That left the whitelist alone, and it cannot move to the environment. The
tempting check — "a concept module declares no theorem" — is not an
environment property: a ``structure`` eagerly generates ``mk.injEq``,
``mk.inj``, and ``mk.sizeOf_spec``, all of theorem kind, while a plain ``def``
generates none, since equation lemmas are produced lazily. The check would
pass def-only concepts and fail every concept containing a structure.
``example`` and ``set_option`` leave no trace at all. So the whitelist needs
a parser, and it is the only thing that does.

We dropped it rather than keep a parser for one editorial rule. Nothing in
the archive's guarantees touches the dialect: statements are axioms, proofs
are kernel-checked, sorry-freeness is environment-derived. A concept written
in violation is unreadable, not unsound, and unreadable is precisely what the
social layer already exists to catch — an endorser who cannot follow a
concept declines to endorse it. The dialect now sits in Future work: stated, cooperated with,
enforced later. (The ``set_option`` kernel-bypass pitfall that once sat
beside it is closed outright by the Replay phase.)

The cost is real and worth naming: an unenforced rule in a document that AI
agents read as authoring instructions will be violated more often than one
the build rejects, and ``lax build`` can no longer tell an author they have
put a proof in a concept. We accept that on the grounds that the failure mode
is a bad submission rather than a false one, and that the archive is small
enough for now that bad submissions are visible.

A route we did not take, recorded in case enforcement becomes worth its
weight: have the inspector observe commands *during* ``lake build`` as a Lean
plugin, giving exact syntax and exact environment together. It is
architecturally cleaner than any re-parse and would deliver both the dialect
check and a per-declaration layer. We avoided it because it means injecting
arguments into the submission's own build and we are not certain how that
interacts with Lake's artifact cache — a cache miss on mathlib costs an hour
per build. (Note that the in-process inspection decision below now weighs
against this route for a second reason: a plugin runs inside the untrusted
build, so nothing it reports would be authentic.)

**In-process inspection.** *Resolved: the inspector is an executable, never
an elaborated command.* Earlier designs ran inspection by elaborating a
generated driver file — imports of the inspector and of the package's root
module, followed by an inspection command — inside the untrusted workspace.
That is unsalvageable, not merely fragile: importing a module runs its
``initialize`` blocks, arbitrary interpreted IO, in the inspecting process
before any command elaborates. A submission could legally shadow the
command itself (demonstrated on Lean 4.31), and fixing that still leaves an
initializer free to fork a process that rewrites the report file after the
run. Once untrusted code has run in a process, nothing the process writes
is authentic. The executable closes this by construction — and turned out
simpler too: the driver file, the temporary directory, the ``LEAN_PATH``
appending, and the report-path environment variable all disappeared. The
same threat model, followed one step further, produced the Replay phase:
the attacker also controls the process that *wrote* the oleans, so the
inspector's honesty is worthless without an independent kernel re-check —
for which we use ``leanchecker``, bundled with the toolchain since v4.28,
rather than reimplement a security-critical tool.

The one casualty is pretty-printing. Delaborators and unexpanders are
imported *code*; running mathlib's (trusted, pinned) would mean running the
submission's too, so statement signatures render with core notation only —
``∀``, ``→``, ``=`` survive, mathlib notation does not. The recorded
upgrade path, should the display cost bite: a second, explicitly untrusted
display pass — the old driver mechanism — whose output the CLI merges into
display-only fields, so a lying submission could deface its own signature
strings but never a fact. ``build-output.json`` is derived data, so this is
safe to defer.

**Forged upstream statements.** *Resolved: dependency artifacts are
provisioned, not authenticated.* The trust chain's weak point was the
imported environment: default-mode replay trusts imports, and the database
cross-check compared statement names only. Compile runs attacker code
inside the very workspace Replay and Inspect later read, so that code can
overwrite a required package's olean with a forgery — ``axiom
Lax42.SomeClaim : True`` under the registered name. The forgery is
kernel-valid (an axiom type-checks whatever it claims, so even ``--fresh``
replay accepts it), its name occurs in the registered
``build-output.json``, and a proof of ``True`` is defeq to it: the archive
would mark the real, different statement proven. Kernel checking cannot
close this hole even in principle — axioms are exactly what the kernel
takes on faith — so the gap is one of authenticity, not validity.

Routes we considered and rejected. Per-statement type digests in
``build-output.json``, compared against the workspace: blocks the exploit
above, but not its variant that keeps the axiom's type byte-identical and
redefines a constant the type mentions in a forged neighboring module —
meaning lives in the transitive dependency cone, so a sound digest is a
Merkle hash over that cone, which is content-addressing the environment:
machinery out of proportion to the problem. Rebuilding upstream from its
pinned source and comparing: re-runs upstream's untrusted code on every
submission and leans on bit-reproducibility.

The resolution replaces the artifacts instead of authenticating them: the
trusted artifact store (see Archive Server) is the only source of
dependency artifacts Replay and Inspect ever see, populated only by the
server itself (mathlib and core, against the pins) and by capture at
registration (submissions, right after their own Replay passed). Local
``lax build`` takes its workspace at its word — an author can always lie
to themselves — which is acceptable because registration is gated
exclusively by the server's run.


