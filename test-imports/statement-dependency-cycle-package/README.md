# Statement Dependency Cycle

This package is a negative fixture for manifest-level statement dependency
cycles.

Expected rejection: `general/manifest-check.mjs` reports a cycle because two
current-submission statement entries list each other in `SemanticDependencies`.
