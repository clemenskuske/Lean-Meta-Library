# High Level Documentation

lax:  lean archive

This project aims to archive and connect lean formalizations. What arxiv is to preprints, this project shall be to lean formalizations.

## Declararions

The basic building blocks of this archive are **declarations**. A declaration pairs
- a mathematical object (either a definition or statement), presented in natural language  (via Tex or markdown), and
- a faithful encoding of this object in lean (either as def or as axiom).

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

- The **declaration package** contains lean statements and definitions without proofs. It merely annotates which natural language statements/definitions are formalized by which lean declarations. The surface package is supposed to be especially clean lean code (to be defined in subsection!) written for and in collaboration with humans. It covers the minimal trust boundary that is not covered by the lean checker. surface packages and their contents and dependencies etc can be browsed at (link to website).

TODO: it is supposed to contain the minimal content to fully specify the semantics of the things we want to prove??
TODO: it doesnt need to be fully self contained, it can use declarations from other submissions.

- the **proof package** contains the actual lean proofs. It is supposed to compile without sorries, but otherwise anything goes. It contains annotations highlighting which surface-level statements it proves. It’s proven statements are orthogonal to the surface package: It may leave  proof obligations of the submissions surface package open, and it may prove proof obligations from other submissions. As the correctness of proofs can be checked by lean, the writing of the proof package can be fully outsurced to to ai agents without compromising correctness.


TODOS for manifest.yaml (to decide)

abstact:
Here, we prove \Cref{submissionsname.maintheorem}.

highlighted statements?
orders on statements?


## Community Review
While the correctness of the proof packages is checked by lean itself, we still require human effort to check that the formal surface statements match their natural language counterparts. Contributors can register with their ORCID identity and publicly approve of flag submitted formalizations, thereby helping us to close the trust obligations.

TODO: we now have two authentication mechansisms: github and orcid. we need to clearly separate their concerns. github for code and orcid for scientific identities?

## Versioning

Unlike most software projects where code freely changes over time, submissions are (for now) frozen in time. This makes it easy for later submissions to reference earlier submissions, allowing the organic growth of a dependency network mirroring the citations of scientific publications. We understand that this brings along its own problems, which we believe are worth it for now.

In particular, we pin the recommend lean version to xxx, lake version to xxx, and mathlib to xxx. Updating the shared mathlib version would immediately make all existing submissions obsolete, and we therefore intend to update mathlib only very infrequently. TODO: We dont claim anything because we are unsure about the future??? In the future, we may explore less invasive options for mathlib updates.

Moreover, You may mark a submission as "work-in-progress" which allows you to freely overwrite it. However, this prevents downstream submissions from citing your work, as we do not (yet?) allow work-in-progress dependencies.


# Implementation Details

## Manifest

TODO: give one complete example of a manifest file, briefly explaining each relevant flag.
TODO: shall we rename ``submission slug`` to ``submission id``? Then all our objects have ids.

## Namespaces and Ids

Each declaration and proof has an ``id`` corresponding to its name in the global namespace.
We enfore that declarations and proofs of a submission ``mysubmission`` are contained within the namespaces ``mysubmission.decs`` and ``mysubmission.proofs``, respectively (allowing subnamespaces).
To avoid colliding ids, no two objects may have the same name.

example:
id of submission:``mysubmission``
id of a declaration within: ``mysubmission.decs.OptionalNestedSubNamespaces.mydeclaration``
id of a proof within: ``mysubmission.proofs.OptionalNestedSubNamespaces.myproof``


## Natural Language Math

Natural language math is written in latex (to the degree it is supported by pandoc).
This should allow all we need and more: sections, bold/italic, inline and display math, macros, etc.
We add a new custom command ``\Cref{id}`` that renders to ``Declaration/Proof/Submission nameOfObject``

## Declaration Package

Every module of submission ``mysubmission`` starts by opening
the namespace ``mysubmission.decs`` and ends by closing it.
It is not allowed to open and close other namespaces. But it is allowed to place
objects into subnamespaces as in ``def Sub.Name.Space : Nat := 0``.

To lift a lean declaration into the archive, one adds two lean annotations
``@[name text]``, where ``text`` is a short description like "Ramsey's theorem for simple graphs".
``@[naturalLanguageInline text]``, where ``text`` is the full natural language half of the statement
``@[naturalLanguageFile file]``, where ``file`` is either tex or tex-flavored-markdown

Not all lean declarations need to get these annotations.
Lean declarations without them are called "hidden declarations", and will be given less prominence on the website.


## THREE SUGGESTED BUILDING BLOCKS (Version 1)

I suggest the basic building blocks of our submissions are **declarations**, **concepts** and **proofs**.

A **Declaration** is an individual lean declaration, def or axiom. 
They may be annotated with names and natural language descriptions to make them more interpretable on the website.
The **semantic closure** of a declaration is the set of all declarations required to state it.


A **concept** is a natural language description of a mathematical concept (e.g.a theorem or a definition in a paper)
together with a set of lean declarations that faithfully encode the concept.
Each concept has **dependencies**, which are other concepts that are required to state the concept.

Concepts are encoded in `metadata.yaml` via the following entries
    - `id`: a unique identifier
    - `name`: a natural language name like "ramsey's theorem" or "treewidth"
    - `declarations`: a list of lean declarations that faithfully encode the concept. Does not need to be semantically closed.
    - `dependencies`: a list of other concepts that are used to define the new concept.

Key rule: Every declaration in the semantic closure of the declarations of concept X
needs to be either contained in the declarations of X,
or in the semantic closure of the declarations of a dependency of X.
This rule ensures that a concept's semantic closure is covered by its's transitive dependencies.

Declararions can be in multiple concepts. Therefore, the dependencies can not be automatically derived:
There maybe multiple incomparable ways to cover the semantic closure with concepts.

Additional considerations:
Concepts can use declarations from other submissions.
A declaration that is in no concept is allowed, but issues a warning during build.

For proofs, I see two possible ways to go:

1) A **proof** takes a set of statement-declarations and derives an output statement-declaration.
This is the finer, more natural granularity than 2).
But as statement-declarations can be in multiple concepts, one cannot uniquely say things like "this concept is used to prove that concept".

2) A **proof** takes a set of concepts and derives an output statement-declaration.
A concept is proven if all statement-declarations inside it are proven.
This lets us say "this concept is used to prove that concept",
and allows us to create a proof graph on the level of concepts, which might be nicer to visualize.

## THREE SUGGESTED BUILDING BLOCKS (Version 2)

I suggest the basic building blocks of our submissions are declarations, concepts and proofs. A Declaration is an individual lean declaration, def or axiom. They may be annotated with names and natural language descriptions to make them more interpretable on the website. The semantic closure of a declaration is the set of all declarations required to state it. A concept is a natural language description of a mathematical concept (e.g. a theorem or a definition in a paper) together with a set of lean declarations that faithfully encode the concept. Concepts are encoded in `metadata.yaml` via the following entries
- `id`: a unique identifier
- `name`: a natural language name like "ramsey's theorem" or "treewidth"
- `declarations`: a list of lean declarations that faithfully encode the concept. Does not need to be semantically closed.

Key rule: Every declaration belongs to exactly one concept. Concepts partition the declarations of the archive (declarations of the trusted base, i.e., the pinned mathlib, are exempt).

Because ownership is unique, dependencies do not need to be declared: concept X depends on concept Y if and only if the semantic closure of a declaration of X contains a declaration owned by Y. The concept dependency graph is derived automatically from the declaration DAG. There is nothing to annotate and nothing that can drift out of sync.

Additional considerations:
- Concepts can depend on declarations from other submissions, but never claim them. Ownership is immutable within a frozen submission.
- If a lemma feels like it belongs to two concepts, it doesn't: extract it into its own (possibly small) concept that both depend on. Any overlapping assignment can be decomposed this way.

For proofs, the situation simplifies. A proof takes a set of statement-declarations and derives an output statement-declaration.
This uniquely identifies the set of concepts used in the proof.

One thing to watch either: the derived concept graphs (both dependency and proof) are not automatically acyclic, since interleaved ownership can create cycles even though the declaration DAG is acyclic. We should forbid this?


## THREE SUGGESTED BUILDING BLOCKS (Version 3)

**Declaration.** Any single Lean declaration (def, structure, inductive, instance, axiom, ...). Definitions encode mathematical objects: 
Axioms encode statements whose proofs are provided separately.

A **proof** is a lean proof that assumes a set of statements (i.e. declarations) and derives an output statement.

**Concept.** A concept encodes one well-defined mathematical unit (a definition or theorem as it would appear in a paper), both as natural-language mathematics and as a faithful Lean formalization. Technically, a concept is a single Lean module containing exactly one module docstring (first command after imports) followed by its declarations. Each docstring, that is,  /-! -/ for the module, /-- -/ for declarations, begins with a level-1 Markdown header giving a title (not necessarily unique; identity is the module path / declaration name), followed by an optional natural-language description of the intended mathematics. Every public declaration carries a docstring.

Example:

    /-!
    # Title of the concept, e.g. Twin-width
    Natural language description of the concept. E.g., we define twin-width via contraction sequences ...
    -/

    /--
    # Title of the declaration, e.g., Contraction Sequence
    Optional natural language descrition of the declaration
    -/
    def ContractionSequence ...

    /--
    # Red Graph
    Descrition
    -/
    def RedGraph ...


**Declaration use graph.** For declarations d, e, write d ⤳ e iff e occurs among the constants of d's type or definitional body (for theorems: the type only).

**Concept DAG.** The concept DAG rooted at a concept A is obtained by projection: take the ⤳-reachability set of A's declarations (its semantic cone), map each reached declaration to its owning concept, and inherit the edges — concept C points to concept D iff some reached declaration of C uses, in one ⤳-step, a reached declaration of D. Acyclicity follows from acyclicity of imports. Reached constants owned by no concept (mathlib, core) form A's background footprint and are not expanded. This is a smaller graph than just following the imports.


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
- to avoid RCE surface packages can only use whitelist dialect. At this point we only define this implicitly by whatever the check accepts. May change down the road


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

not all declarations in the surface file need to be published.
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
