#!/usr/bin/env node
import { normalizeSubmissionRow, validateSubmissionRow } from "../submission-schema.mjs";

const row = {
  SubmissionData: {
    SubmissionSlug: "UnicodeInlineLean",
    SubmissionName: "Unicode Inline Lean",
    AbstractPath: "abstract.tex",
    BibEntries: [],
    LicenseFile: "LICENSE",
    ManifestPath: "unicode-inline-lean-package/manifest.yaml",
    SubmissionUserId: "12345",
    Repo: "https://github.com/example/unicode-inline-lean",
    Commit: "0123456789abcdef0123456789abcdef01234567"
  },
  StatementSubmissions: {
    rootFolder: "statements",
    statements: [
      {
        Name: "UnicodeInlineLean.Statements.Main.reachable",
        Type: "Axiom",
        InlineLeanStatement:
          "axiom reachable {V : Type u} (G : SimpleGraph V) :\n" +
          "    (∀ u v : V, G.Reachable u v) → ¬ False"
      }
    ]
  },
  ProofSubmissions: {
    rootFolder: "proofs",
    proofs: [
      {
        Name: "UnicodeInlineLean.Proofs.Main.reachable",
        AxiomReference: "UnicodeInlineLean.Statements.Main.reachable",
        InlineLeanStatement:
          "theorem reachable {V : Type u} (G : SimpleGraph V) :\n" +
          "    (∀ u v : V, G.Reachable u v) → ¬ False := by\n" +
          "  intro _\n" +
          "  exact False.elim"
      }
    ]
  }
};

const validation = validateSubmissionRow(row);
if (!validation.valid) {
  const details = validation.errors
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("; ");
  throw new Error(`expected submissions.jsonl row with Unicode InlineLeanStatement to pass schema validation: ${details}`);
}

const normalized = normalizeSubmissionRow(row);
if (normalized.statementFolder !== "unicode-inline-lean-package/statements") {
  throw new Error(`expected statementFolder to be manifest-relative, got ${JSON.stringify(normalized.statementFolder)}`);
}
if (normalized.proofFolder !== "unicode-inline-lean-package/proofs") {
  throw new Error(`expected proofFolder to be manifest-relative, got ${JSON.stringify(normalized.proofFolder)}`);
}

console.log("submission-record schema accepts Unicode InlineLeanStatement fields");
