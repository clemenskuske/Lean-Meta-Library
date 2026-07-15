# Introduction and Vision

TODO: adapt this section to the new stuff layout out in the ===-delimited sections below

lax:  lean archive

This project aims to archive and connect lean formalizations. What arxiv is to preprints, this project shall be to lean formalizations.

## Declararions

The basic building blocks of this archive are **declarations**. A declaration pairs
- a mathematical object (either a definition or statement), presented in natural language  (via Tex or markdown), and
- a faithful encoding of this object in lean.

The meaning of a declaration may depend on other declarations We visualize these dependencies via what we call the **Semantic DAG**.

Example: the following diamond DAG. kuratowskis theorem depends on planar graphs and subdivisions, which both depend on graphs. 

## Proofs

A proof takes a set of input statements (named assumptions) (which are declarations) and derives an output statement (named conclusion). We can model the network of proofs as a directed bipartite graph between statements and proofs. Each proof is represented by a node labelled ⊦ with incoming edges from the assumptions and an outgoing edge to the conclusion. An self-contained (?) proof has no incoming edges. By navigating the Proof Circuit, we can see which statements are already proven, which are still conjectures, and which are proven relative to other conjectures.

Example: a theorem X that follows from either A and B or from C and D,  A and C are fully proven (incoming ⊦ with no dependency). 

  X
  ^^ 
  | \
  ⊦ 
 ^^
 / \
A   B   C   D
^       ^
|       |
⊦       ⊦

We hope this visualization encourages other authors to fill some of the missing proof obligations of key results. A list of the biggest open obligations can be found (link to website)

## Submissions 
The basic unit is  **submission**. Each submission consists of a manifest file together with two separate lake files or lean projects. More concretely: 

- **manifest.yaml** states title, abstract etc. the data format can be found under todo.

- The **concept package** contains lean statements and definitions without proofs. It merely annotates which natural language statements/definitions are formalized by which lean declarations. The concept package is supposed to be especially clean lean code (to be defined in subsection!) written for and in collaboration with humans. It covers the minimal trust boundary that is not covered by the lean checker.
concept packages and their contents and dependencies etc can be browsed at (link to website).

TODO: it is supposed to contain the minimal content to fully specify the semantics of the things we want to prove??
TODO: it doesnt need to be fully self contained, it can use declarations from other submissions.

- the **proof package** contains the actual lean proofs. It is supposed to compile without sorries, but otherwise anything goes. It contains annotations highlighting which concept-level statements it proves. It’s proven statements are orthogonal to the concept package: It may leave proof obligations of the submissions concept package open, and it may prove proof obligations from other submissions. As the correctness of proofs can be checked by lean, the writing of the proof package can be fully outsurced to to ai agents without compromising correctness.



## Community Review
While the correctness of the proof packages is checked by lean itself, we still require human effort to check that the formal concept statements match their natural language counterparts. Contributors can register with their ORCID identity and publicly approve of flag submitted formalizations, thereby helping us to close the trust obligations.

TODO: we now have two authentication mechansisms: github and orcid. we need to clearly separate their concerns. github for code and orcid for scientific identities?

## Versioning

Unlike most software projects where code freely changes over time, submissions are (for now) frozen in time. This makes it easy for later submissions to reference earlier submissions, allowing the organic growth of a dependency network mirroring the citations of scientific publications. We understand that this brings along its own problems, which we believe are worth it for now.

In particular, we pin the recommend lean version to xxx, lake version to xxx, and mathlib to xxx. Updating the shared mathlib version would immediately make all existing submissions obsolete, and we therefore intend to update mathlib only very infrequently. TODO: We dont claim anything because we are unsure about the future??? In the future, we may explore less invasive options for mathlib updates.

Moreover, You may mark a submission as "work-in-progress" which allows you to freely overwrite it. However, this prevents downstream submissions from citing your work, as we do not (yet?) allow work-in-progress dependencies.


======================================================================================================================

# Datastructures

We define the basic building blocks of the archive and the constraints we place
on them.

## Declarations

A **declaration** is a single Lean declaration command. Besides its named
constant, a declaration comprises all auxiliary kernel constants its command
generates (e.g., a ``structure`` also generates its constructor and
projections). 

We say **declaration A depends on declaration B** if some constant of B occurs
in the type or body of some constant of A (theorems: type only).

**Atoms** are the building blocks of the archive: a distinguished subset of the
declarations, specified later (see Concepts and Packages), paired with a
natural-language description. Every atom is declared by one of the commands
``def``, ``abbrev``, ``structure``, ``class``, ``inductive``, ``instance``, or
``axiom`` — though not every such declaration is an atom. An atom declared by
``axiom`` is called a **statement**; its proof is provided separately (see
Proofs).

The **declaration DAG** is the directed graph on the atoms and all declarations
reachable from them, with an edge from A to B if A depends on B. We require
that non-atoms of the declaration DAG do not depend on atoms. The **declaration
DAG rooted at A** is the declaration DAG induced on all declarations reachable
from A.

Caveat: declarations in a ``mutual`` block may depend on each other. With
slight abuse of terminology, we still call the graph the declaration DAG: it is
acyclic except for cycles within mutual blocks.


## Concepts

A **concept** is a set of atoms together with a natural-language text. The
intent is that the text states one well-defined mathematical unit (a definition
or theorem as it would appear in a paper) and that the atoms faithfully
formalize it. Every atom belongs to exactly one concept.


The **concept DAG** is obtained from the declaration DAG by inducing on atoms
and quotienting by concepts (dropping self-loops). We require the concept DAG
to be acyclic; in particular, this forces all atoms of a ``mutual`` block into
the same concept. For a declaration A, the **concept DAG rooted at A** is the
declaration DAG restricted to the nodes reachable from A, induced and
quotiented as above. Note that the concept DAG rooted at A is not necessarily
an induced subgraph of the concept DAG.

## Proofs

A **proof** is a ``theorem`` declaration that is annotated with the
statement it proves. Its **conclusion** is that statement; we
require the theorem's type to match the type of the conclusion (up to
definitional equality?). Its **assumptions** are the statements occurring
in the theorem's axiom set (as reported by ``#print axioms``). (The standard
axioms ``propext``, ``Classical.choice``, ``Quot.sound`` are ignored;
``sorryAx`` is rejected.)

The **proof network** is the directed hypergraph over the statements where
every proof with assumptions A and conclusion c corresponds to a hyperedge (A →
c). A statement is **proven** if it is the conclusion of some proof all of
whose assumptions are (recursively) proven; otherwise it is a **conjecture**.
More generally, a statement is **proven relative to** a set C of conjectures if
it becomes proven once the statements in C are taken as proven.

## Submissions

A **submission** is a set of concepts together with a set of proofs.

## Key-Value Annotations

We annotate concepts, atoms and proofs with various key-value pairs. We require
the following keys, though we may later allow some additional optional keys.

Proof:
    - conclusion: id of the conclusion

Concept:
    - title: natural-language name like "Ramsey's Theorem"
    - description: natural-language description

Atom:
    - title: natural-language name
    - description: natural-language description

Submission:
    - id: an archive-wide unique id
    - TODO


# Implementation of These Datastructures 

## Packages

Lake terminology, which we adopt: a **package** is the unit of distribution — a
folder with a ``lakefile.toml`` that declares its own dependencies; a package
contains one or more **libraries** (``lean_lib`` targets); a library consists
of **modules** (``.lean`` files). Dependencies are declared per package, not
per library.

Each submission creates two Lake packages: a **concept package** containing its
concepts and atoms and a **proof package** containing its proofs. For a
submission ``Mysubmission``, these two packages are called
``mysubmission-cpts`` and ``mysubmission-prfs``. We use two packages (rather
than two libraries within one package) because the two need different
dependency policies:
- the concept package may depend only on the pinned mathlib and on concept
  packages of other submissions;
- the proof package additionally depends on its own concept package. It may
  depend also on other submissions' proof packages, though this is discouraged
  for safety and hygiene reasons. 

## Namespaces

Each submission with id ``Mysubmission`` corresponds to a top-level namespace
``Mysubmission``. All proofs of the submission are placed into the namespace
``Mysubmission.Prfs``. All atoms of a concept ``Myconcept`` are placed within
the namespace ``Mysubmission.Cpts.Myconcept``. Both proofs and atoms may be
arbitrarily nested within subnamespaces. Submission ids are UpperCamelCase,
since they double as Lean namespaces.

Example:
- id of submission: ``Mysubmission``
- id of an atom of concept ``Myconcept`` within the submission:
  ``Mysubmission.Cpts.Myconcept.OptionalNestedSubNamespaces.Myatom``
- id of a proof within the submission:
  ``Mysubmission.Prfs.OptionalNestedSubNamespaces.Myproof``

## Annotations

We use docstrings to annotate concepts, atoms, and proofs.

An example module within the concept package:

    namespace Mysubmission.Cpts

    /-- annotation of concept A -/
    namespace A

    /-- annotation of atom X -/
    def X ...

    /-- annotation of atom Y -/
    axiom Y ...

    end A

    /-- annotation of concept B -/
    namespace B

    /-- annotation of atom U -/
    def U ...

    /-- annotation of atom V -/
    axiom V ...

    end B

    end Mysubmission.Cpts


An example module within the proof package:

    namespace Mysubmission.Prfs

    /-- annotation of proof P -/
    theorem P ...

    end Mysubmission.Prfs

Each annotation is a docstring that we parse as markdown with optional yaml frontmatter (common pattern for static site generators).
When placing the whole docstring into json, the markdown at the end gets placed into the ``description`` key

    /--
    ---
    key: value
    key: value
    key: value
    ---
    description
    -/

## Claude's idea on how to annotate namespaces (Side comment)

By default, docstrings can only annotate lean declarations, but with some tweaks (discussed below), they can also annotate namespaces.

register your own environment extension mapping Name → String, and add syntax that makes /-- ... -/ namespace A legal by elaborating the doc into your extension and then delegating to the real namespace command:

    import Lean
    open Lean Elab Command

    initialize namespaceDocExt :
        SimplePersistentEnvExtension (Name × String) (NameMap String) ←
      registerSimplePersistentEnvExtension {
        addEntryFn := fun m (n, d) => m.insert n d
        addImportedFn := fun arrs =>
          arrs.foldl (fun m es => es.foldl (fun m (n, d) => m.insert n d) m) {}
      }

    syntax (name := docNamespace) (priority := high)
      docComment "namespace" ident : command

    elab_rules : command
      | `(docNamespace| $doc:docComment namespace $id:ident) => do
        let text ← getDocStringText doc
        -- resolve relative to the current namespace, like `namespace` itself does
        let ns := (← getCurrNamespace) ++ id.getId
        modifyEnv (namespaceDocExt.addEntry · (ns, text))
        elabCommand (← `(namespace $id))

and retrieval is `(namespaceDocExt.getState env).find? A`. Since it's a persistent extension, the docstrings survive across imports, so downstream files and doc tooling can query them.

==============================================================================================

# Implementation Details inside Lean


## Manifest

TODO: give one complete example of a manifest file, briefly explaining each relevant flag.
TODO: shall we rename ``submission slug`` to ``submission id``? Then all our objects have ids.



## TODO: leftovers from this morning

This archive does not store submissions, but merely aggregates, presents and links them. Users submit their formalizations in the form of pointers to specific commits and folders in their public git repos, allowing clear attribution of work. To prevent link rot, we may create our own backup copy (e.g. using https://archive.softwareheritage.org/save/)

To allow interaction with our system, submissions must conform to the following rules. 

Each submission is a folder in a public git repository consisting of
- a manifest.yaml file in root position with the following contents
    - TODO
    - TODO
    - TODO
    - TODO
    - TODO
    - TODO
- A proof and declaration lean package with the following tool chains: todo
    - where does the lakefile live?
    - are there restrictions of what can and cannot be in the lakefile?
    - TODO
    - TODO
    - TODO
    - TODO

It must satisfy various rules:
- to avoid RCE concept packages can only use whitelist dialect. At this point we only define this implicitly by whatever the check accepts. May change down the road


TODO: fully specify the lean dialect of the declaration package
- do we allow namespaces?
- TODO
- TODO
- TODO

TODO: do we also want to layout what the submission.json typically looks like in this subsection?

# Internal interfaces

## relevant files
for each submission, there exist:
- manifest.yaml: the small input file containing mostly metadata
- submission.json:  the larger file generated by the build process containing all information consumed by the website.

moreover, in the root dir of the repo, there exist:
- submissions.jsonl: the list of all submissions in the archive, managed by the cli (pretty printed for manual inspection)

not all declarations in the concept file need to be published.
- one "publishes" a proof by annotating it with ``@[proves submissionname.DeclarationName]`` and ``@[dependsOn DeclarationName1 submissionname.DeclarationName2 ...`` or similar.


## suggested changes of submission.json
- lets normalize redundant entries. It seems like AxiomDependencies is the same as SemanticDependencies of the corresponding statement entry? if yes, drop it

- for each declaration we should have
	- file name
	- line number range for declaration
	- line number range for docstring?
	- contents of declaration and docstring?
    - ??

TODO: optional, maybe later
- for each declaration file we should have
	- list of contained statements
	- line number range of docstring
	- contents of docstring?
    - ??
 
# apis and implementations

## building submissions
"lml build submission path-to-submission" constructs submission.json from manifest.yaml, source code and includes. It only needs to look at stuff within the included entries of the lakefile of the submission. (i.e., it does *not* do the global prooftree). Thus run time is proportional to submission size.

## building submissions implementation

Probably we want to have a wrapping package with our own package cache location and imports of dependencies filtered from the submission yaml 

This would help us
- to have a flag to reset the package folder with the mathlib
- Build multiple submissions in parallel?

## global prooftree 
"lml build globalprooftree rootdir" can do the full global subsitution build of all proofs. Considers only submissions contained in rootdir (recursively scans for manifest.yaml files to identify submissions). So to do it on the server, one needs to place all submissions into the rootdir.

## building the website
"lml build website target1 target2 ...", where each target is of either of the following types
- submission.jsonl (to append multiple entries)
- submission.json (to append single entries)
This creates a static website containing all targets


# website 

## website layout

**submission view**: contains
- title
- Abstract (allows \cref to other submissions or declarations etc)

- as overview: Semantic dag with new declarations , ending at external grayed out external dependencies. TODO: paremterize and see what works best. toggles on website?
- As overview: proof circuit induced on all declarations appearing in proof package. Mark external declarations, mark proven and unproven ones

- list of new declarations (clickable, names big with small teaser prefix of natural language statement)
- list of newly proven declarations (with list of unproven dependency declarations, maybe also the proven ones?

- all external semantic dependencies and things for which this is a dependency (grouped bysubmissions)
- All external proof dependencies and things for which this is a dependency (grouped by submissions)


**declaration view**: 
- show natural and formal statement next to each other

- thee expansion modes for semantics
  - include all unnamed dependencies
  - Include the next named dependency with natural language text
  - Include all dependencies
 
The surface lean dialect needs to be so that the semantics can be fully deduced from this view. We do not allow opening namespaces for example?

- Show the full semantic dependency DAG

- Show the full incoming proof graph: all statements that are used to prove something about this. 


**proof view**: todo


# website endorsemnts

For each statement there is a button: “I have read the formal statement/definition, it’s semantic dependencies, and I believe that it faithfully encodes the corresponding natural language statement.""

Also allow a comment section below each statement/definition? List aggregated comments also of semantic dependencies?

# website auth

Users log in through orcid oauth. This way, all endorsements of formalizations are backed by actual scientific identities


# REST

TODOS for manifest.yaml (to decide)

abstact:
Here, we prove \Cref{submissionsname.maintheorem}.

highlighted statements?
orders on statements?

