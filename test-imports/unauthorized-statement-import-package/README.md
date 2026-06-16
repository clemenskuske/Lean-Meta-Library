# Unauthorized Statement Import

This package is a negative import fixture. A statement file imports
`Unauthorized.External` without an authorized statement-package dependency or
declared `DeclarationReferences` manifest.

Expected rejection: `statements/imports.mjs` reports that the statement import
is not authorized by manifest.
