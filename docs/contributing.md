# Contributing

Thank you for improving TraSH. Contributions should be small, test the behavior
they change, and keep the parser and virtual machine consistent.

## Set up the environment

You need Node.js and pnpm. The repository includes `pnpm-lock.yaml`, so use
pnpm to install the locked versions:

```sh
pnpm install
```

Husky installs local hooks during preparation. The pre-commit hook runs the
full test suite.

## Project layout

| Path | Contents |
| --- | --- |
| `src/js/interpreter.mjs` | Tokenizer and parser entry point. |
| `src/js/parser.mjs` | AST construction. |
| `src/js/codegen.mjs` | AST-to-instruction compilation. |
| `src/js/vmachine.mjs` | Execution, variables, and function invocation. |
| `src/js/plugin.mjs` | Public plugin contract. |
| `tests/trash/` | Syntax, control-flow, and command tests. |
| `dist/` | Rollup output; do not edit it manually. |

Production code uses strict Flow and ESM modules. Every production file starts
with `// @flow strict`.

## Development workflow

1. Open an issue for non-obvious changes or syntax changes.
2. Create a branch with one focused purpose.
3. Write or update the test that demonstrates the intended behavior first.
4. Implement the smallest change in `src/js/`.
5. Update `README.md` or `docs/` when public API or syntax changes.
6. Run the checks before opening a pull request.

```sh
pnpm test
pnpm run dev:eslint
pnpm run dev:flow:check
```

`pnpm test` rebuilds `dist/` and runs Jest. Use `pnpm run build` to build
without tests. During development, use `pnpm run dev:rollup:watch`.

## Language changes

A syntax change usually touches more than one layer: tokenization in
`interpreter.mjs`, AST construction in `parser.mjs`, instructions in
`codegen.mjs`, and execution in `vmachine.mjs`. Do not alter only one layer to
cover an isolated test case.

Include normal and edge cases: nested expressions, silent calls, `null` and
`undefined`, and behavior inside functions or loops when relevant. Group tests
by behavior in the existing test files before creating another suite.

## Pull requests

A pull request must state:

- The problem and final observable behavior.
- Tests run and their result.
- Any syntax, compatibility, or documentation changes.
- The related issue, when one exists.

Avoid unrelated formatting or refactors. Do not edit `dist/` directly: Rollup
generates it from `src/js/`. Changes must retain the project's MIT license.
