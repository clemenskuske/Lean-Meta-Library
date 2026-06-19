# Statement Wrong Commit

This negative fixture declares a statement dependency whose repository matches a
row in `submissions.jsonl`, but whose Lake `require` is pinned to a different
commit.

Expected rejection: `statements/imports.mjs` reports that the statement
lakefile dependency is not allowed by `submissions.jsonl`.
