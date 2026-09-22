# Runtime contract

TraSH is an embeddable command language. The host registers its capabilities;
scripts combine them with expressions, functions and control flow.

## Execution limits and cancellation

Each top-level `execute` has a default budget of **1,000,000 VM instructions**.
Nested function calls, argument defaults and higher-order callbacks share that
budget. New top-level executions have independent budgets, including concurrent
ones. A budget must be a positive safe integer.

```js
const vm = new VMachine({
  maxInstructions: 100_000,
  processCommandJob: async ({cmdName, kwargs, signal}) => {
    // Pass signal to cancellable host operations, such as fetch.
    return runHostCommand(cmdName, kwargs, signal);
  },
});

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 1000);
try {
  await vm.execute(program, {
    maxInstructions: 50_000, // optional per-execution override
    signal: controller.signal,
  });
} finally {
  clearTimeout(timer);
}
```

The VM yields to the event loop every 65,536 instructions, including across
nested calls, so timer-driven cancellation can interrupt CPU-only loops.
Cancellation and budget exhaustion throw `ExecutionStoppedError`; `silent`
does not suppress them. The error is available from
`@tardo/trash/exceptions/execution_stopped_error`.

These are cooperative execution controls, not a wall-clock or memory sandbox.
Cancellation cannot forcibly stop a pending callback; the callback must
cooperate with the signal. Plugins receive that same signal in their context.
For hostile scripts, isolate parsing and execution in a terminable
worker/process and enforce wall-clock and memory limits at the application
boundary. Only execute compiled programs produced by your own `Interpreter`,
not instruction objects supplied by clients.

`Interpreter.parse` accepts `maxSourceLength` (default `1_000_000` UTF-16
code units) and `maxNestingDepth` (default `100`). `VMachine` accepts
`maxCollectionLength` (default `100_000`) and `maxStringLength` (default
`1_000_000`). These limits reject oversized source, parser nesting, collection
construction/expansion, and string concatenation. Raise a limit only for a
trusted workload with an independent resource limit.

## Properties and host objects

- Script property keys must be strings or numbers.
- `__proto__`, `constructor` and `prototype` are rejected in subscripts and
  dictionary literals.
- Reads use **own properties only**. Missing properties return `undefined`.
- Array and string indexes and `length` remain available. Nonnumeric array
  lookups can project own properties from its elements; null/missing elements
  contribute `undefined`.
- Command and plugin results preserve their host identity, including
  non-cloneable values. Scripts can mutate returned host objects, so extensions
  must expose only objects they intentionally make script-accessible.
- Script functions are opaque handles. Their callback, arguments, type and
  `unsafe` metadata are never script-visible or script-mutable.
- Host extensions are trusted code. Validate all command input and do not use
  it to select or execute host callbacks.

`unsafe: true` invokes `confirmUnsafe` **when that callback is configured**.
It does not deny execution by default and does not implement authorization.
Apply authorization in the host command handler.

## Variables and functions

- Global variables persist within a VM. `cleanGlobals()` resets variables,
  but does not remove registered commands or named script functions.
- `execute(program, options, new Frame())` isolates the variable frame. The
  command registry still belongs to the VM. Use separate VMs for separate
  user sessions, and serialize executions that intentionally share state.
- Assignment updates the nearest existing variable in the frame chain;
  otherwise it creates a variable in the current frame.
- Functions resolve outer variables through their **calling frame**, not a
  captured lexical closure. Parameters are local to the function call.
- Named function declarations enter the VM command registry, but cannot replace
  an existing command.
- `$fn` reads a function value. `$$fn ...` invokes it. For compatibility,
  `$$fn` in argument position passes functions that declare parameters, but
  invokes zero-parameter functions. Prefer `$fn` when explicitly passing a
  function value, including zero-parameter callbacks.
- Higher-order callbacks validate arguments and apply defaults through the
  same path as ordinary calls. Defaults are evaluated only when omitted.
  Extra values supplied by a higher-order helper are ignored when the
  callback declares fewer parameters.

## Syntax and errors

Single- and double-quoted strings support escaped quotes, backslashes, `\n`,
`\r` and `\t`. Delimiters inside strings do not close surrounding containers.

Comments begin with `//` or `/*` at the start of input or after whitespace,
outside strings. Block comments can span lines and do not nest. This boundary
preserves unquoted shell arguments containing URLs. Comments are masked with
whitespace, preserving source offsets. Unterminated strings, containers and
block comments are rejected during parsing.

`silent command ...` returns `null` when its execution callback throws, for
both internal and host-delegated commands. Syntax errors, argument validation,
rejected unsafe confirmations and execution-control errors still propagate.

Pass `{throwSilentErrors: true}` to `vmachine.execute(...)` to propagate callback
errors from silent calls as well, including nested functions. This option is
per execution and does not change the `silent` flag passed to host commands.
It also applies when collecting all results with the fourth argument.

## Performance

Register commands once and reuse `interpreter.parse(...)` results when running
the same source repeatedly. Avoid reparsing inside execution loops. Compiled
programs depend on command definitions used during parsing; reparse when those
definitions change.

Run `pnpm run benchmark` after building to measure parsing and execution
separately. It reports medians after warm-up and is informational, not a timing
assertion in CI.
