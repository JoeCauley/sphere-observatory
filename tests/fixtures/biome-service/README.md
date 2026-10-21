# Service record test fixtures

`design-examples/` contains byte-exact copies of the frozen design's eleven shape records and two recipe resources. Their provider identities, proofs, index references and core-state placeholders are deliberately unimplemented. They establish structural/static test inputs only and are never bundled catalogue releases or runtime admissions.

`canonical-golden.json` fixes UTF-16 key ordering, UTF-8 bytes, ECMAScript numeric/string serialization and domain-separated record digest vectors. Python hashlib calculated the literal-byte digests independently of the production serializer.
