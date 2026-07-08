# lml ideas

## Documentation

lax:  lean archive

This project aims to archive and connect lean formalizations. What arxiv is to preprints, this project shall be to lean formalizations.

## Declararions

The basic building blocks of this archive are **declarations**. A declaration pairs
- a mathematical object (either a definition or statement), presented in natural language  (via Tex or markdown), and
- a faithful encoding of this object in lean (either as def or as axiom).

The meaning of a declaration may depend on other declarations We visualize these dependencies via what we call the **Semantic DAG**.

Example: the following diamond DAG. kuratowskis theorem depends on planar graphs and subdivisions, which both depend on graphs. 

## Proofs

A proof takes a set of input declarations and derives an output declaration. We can model the network of proofs as a circuit. Each proof is represented by a node labelled  ⊦ with incoming nodes from the assumptions and an outgoing node to the conclusion. An unconditional proof has no incoming edges. By navigating the Proof Circuit, we can see which statements are already proven, which are still conjectures, and which are proven relative to other conjectures.

Example: a theorem that follows from either A and B or from C and D,  A and C are fully proven (incoming ⊦ with no dependency). 

We hope this visualization encourages other authors to fill some of the missing proof obligations of key results. A list of the biggest open obligations can be found (link to website)

## Submissions 
The basic unit is  **submission**. Each submission consists of a metadata file together with two separate lake files or lean projects. More concretely: 

- **metadata.yaml** states title, abstract etc. the data format can be found under todo.

- The **surface package** contains lean statements and definitions without proofs. It merely annotates which natural language statements/definitions are formalized by which lean declarations. The surface package is supposed to be especially clean lean code written for and in collaboration with humans. It covers the minimal trust boundary that is not covered by the lean checker. surface packages and their contents and dependencies etc can be browsed at (link to website).

- the **proof package** contains the actual lean proofs. It is supposed to compile without sorrißes, but otherwise (almost) anything goes. It contains annotations highlighting which surface-level statements it proves. It’s proven statements are orthogonal to the surface package: It may leave  proof obligations of the submissions surface package open, and it may prove proof obligations from other submissions. As the correctness of proofs can be checked by lean, the writing of the proof package can be fully outsurced to to ai agents without compromising correctness.

(TODO: I prefer "surface" over "statement", since the package should contain both definitions and statements. Any other names for this package?)

## Community Review
While the correctness of the proof packages is checked by lean itself, we still require human effort to check that the formal surface statements match their natural language counterparts. Contributors can register with their ORCID identity and publicly approve of flag submitted formalizations, thereby helping us to close the trust obligations.


## Versioning

Unlike most software projects where code freely changes over time, submissions are (for now) frozen in time. This makes it easy for later submissions to reference earlier submissions, allowing the organic growth of a dependency network mirroring the citations of scientific publications. We understand that this brings along its own problems, which we believe are worth it for now.

In particular, we pin the recommend lean version to xxx, lake version to xxx, and mathlib to xxx. Updating the shared mathlib version would immediately make all existing submissions obsolete, and we therefore intend to update mathlib only very infrequently. In the future, we may explore less invasive options for mathlib updates. You may nevertheless submit works with a different mathlib version, but note that you may not cite or be cited by works with a different version than yours. 

If you want to apply changes to your submission, you may resubmit the submission and mark it as new version. This makes both the new and old version avaliable for other authors to build upon.

Moreover, You may mark a submission as "volatile" which allows you to freely overwrite it. However, this prevents downstream submissions from citing your work, as we do not (yet?) allow volatile dependencies.


## More Implementation Details

This archive does not store submissions, but merely aggregates, presents and links them. Users submit their formalizations in the form of pointers to specific commits and folders in their public git repos, allowing clear attribution of work. To prevent link rot, we may create our own backup copy (e.g. using https://archive.softwareheritage.org/save/)

To allow interaction with our system, submissions must conform to the following rules. 

Each submission is a folder in a public git repository consisting of
- a metadata.yaml file in root position with the following contents: todo
- A proof and surface lean package with the following tool chains: todo

It must satisfy various rules:
- to avoid RCE surface packages can only use whitelist dialect. At this point we only define this implicitly by whatever the check accepts. May change down the road
- …


# Internal interfaces

## relevant files
for each submission, there exist:
- metadata.yaml: the small input file containing mostly metadata
- submission.json:  the larger file generated by the build process containing all information consumed by the website.

moreover, in the root dir of the repo, there exist:
- submissions.jsonl: the list of all submissions in the archive, managed by the cli (pretty printed for manual inspection)

## suggested changes of metadata.yaml

- one "publishes" a surface declaration by annotating it with ``@[public]``. not all declarations in the surface file need to be published.
- one "publishes" a proof by annotating it with ``@[proves DeclarationName]`` and ``@[dependsOn DeclarationName1 DeclarationName2 ...`` or similar.

## suggested changes of submission.json
- lets normalize redundant entries. It seems like AxiomDependencies is the same as SemanticDependencies of the corresponding statement entry? if yes, drop it

- for each declaration we should have
	- file name
	- line number range for declaration
	- line number range for docstring
	- contents of declaration and docstring?
    - ??

- for each surface file we should have
	- list of contained statements
	- line number range of docstring
	- contents of docstring?
    - ??
 
# apis and implementations

## building submissions
"lml build submission path-to-submission" constructs submission.json from manifest.yaml, source code and includes. It only needs to look at stuff within the included entries of the lakefile of the submission. (i.e., it does *not* do the global substitution). Thus run time is proportional to submission size.

## building submissions implementation

Probably we want to have a wrapping package with our own package cache location and imports of dependencies filtered from the submission yaml 

This would help us
- to have a flag to reset the package folder with the mathlib
- Build multiple submissions in parallel?


## global substitutioncheck
"lml build substitutioncheck rootdir" can do the full global subsitution build of all proofs. Considers only submissions contained in rootdir (recursively scans for metadata.yaml files to identify submissions). So to do it on the server, one needs to place all submissions into the rootdir.

## building the website
"lml build website target1 target2 ...", where each target is of either of the following types
- submission.jsonl (to append multiple entries)
- submission.json (to append single entries)
This creates a static website containing all targets


# website 

## website layout

**submission view**: contains
- title
- Abstract (allows cref to other submissions or declarations etc)

- as overview: Semantic dag with new declarations , ending at external grayed out external dependencies
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

- Show the full incoming proof circuit: all statements that are used to prove something about this. 


**proof view**: todo


# website endorsemnts

For each statement there is a button: “I have read the formal statement/definition, it’s semantic dependencies, and I believe that it faithfully encodes the corresponding natural language statement.""

Also allow a comment section below each statement/definition? List aggregated comments also of semantic dependencies?

# website auth

Users log in through orcid oauth. This way, all endorsements of formalizations are backed by actual scientific identities
