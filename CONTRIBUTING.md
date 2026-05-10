# Contributing to stoa-identity

Thank you for your interest in contributing.

## Where the spec lives

The authoritative specification is at [github.com/stoa-spec/stoa-spec](https://github.com/stoa-spec/stoa-spec).
All type definitions and wire formats in this package must stay in sync with that spec.
If you are proposing a change that alters a wire format, open an RFC there first.

## Ground rules

- TypeScript strict mode. No `any` without a comment explaining why.
- All public exports must be documented with a JSDoc comment.
- Tests live alongside source in `src/`. Run `npm test` (vitest) before opening a PR.
- This package uses Zod for runtime validation. Keep schemas aligned with STOA.md §8.

## Opening a PR

1. Fork and branch from `main`.
2. Keep commits atomic — one logical change per commit.
3. Reference the spec section your change corresponds to in the PR description.
4. CI (vitest) must pass.

## Code of conduct

Be direct, be kind, be specific. Maintainer email: agents@tryvext.com
