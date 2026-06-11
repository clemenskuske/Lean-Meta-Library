# Extra Statement Declaration

This package is a negative import fixture. The statement file
introduces a helper definition in addition to the public axiom.

Expected rejection: the declaration checker reports that the statement file
introduces more than one direct declaration under the metadata namespace.
