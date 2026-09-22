<h1 align="center">
  <div>TraSH</div>
  <small>~ Capability-based application scripting ~</small>

[![Tests](https://github.com/Tardo/TraSH/actions/workflows/tests.yml/badge.svg)](https://github.com/Tardo/TraSH/actions/workflows/tests.yml)
</h1>

TraSH is a lightweight, capability-based scripting language for adding programmable workflows to JavaScript
applications. The host defines the commands a script can use, validates their arguments, and performs their side
effects. Scripts combine those capabilities with expressions, variables, functions, and control flow.

Scripts run through TraSH's parser and virtual machine — **no JavaScript `eval()`**. TraSH was extracted from
[OdooTerminal](https://github.com/Tardo/OdooTerminal), where its command-oriented scripting model was developed.

Execution has configurable instruction, source-size, nesting, collection, and string limits, and supports `AbortSignal`
cancellation. See the [runtime contract](docs/runtime.md) for host-object handling, scope rules, and the limits of these
controls.

## Why TraSH?

Use TraSH when an application needs more than expressions or data transformations, but should not expose arbitrary
JavaScript. It is a middle ground between expression engines and full JavaScript runtimes:

| If you need                                               | Use                                                 |
| --------------------------------------------------------- | --------------------------------------------------- |
| Rules, filters, or JSON transformations                   | An expression engine such as CEL, JEXL, or JSONata. |
| User-defined workflows composed from application commands | TraSH.                                              |
| Untrusted scripts or a hardened isolation boundary        | A dedicated JavaScript runtime or sandbox.          |

This model fits user automations, administrator rules, and agent-generated workflows: the application owns the
vocabulary (`search`, `create`, `notify`, and so on), while scripts own the logic that composes it.

TraSH does not grant direct access to Node.js, the DOM, network APIs, or host globals unless the host deliberately
returns one through a command or plugin. Its instruction budget and cancellation are cooperative execution controls, not
a wall-clock or memory sandbox. For hostile scripts, run parsing and execution in a terminable worker or process; see
the [runtime contract](docs/runtime.md#execution-limits-and-cancellation).

## Installation

```sh
npm install @tardo/trash
```

The package is ESM, so consumers must use `import` or `.mjs` files.

The optional standard-library plugins are available separately in
[`@tardo/trash-stdlib`](https://github.com/Tardo/TraSH-stdlib):

```sh
npm install @tardo/trash-stdlib
```

## Flow

The package includes `.mjs.flow` files generated from its typed source during the build. Flow discovers them
automatically, including for deep imports.

```js
import type {CMDDef, VMachineOptions} from '@tardo/trash';
import type {ProcessCommandJobOptions} from '@tardo/trash/vmachine';
```

## Complete example

The following program declares a TraSH function and delegates the `notify` command to the JavaScript host. It configures
an instruction budget and timer-driven cancellation. Save it as `example.mjs` and run `node example.mjs`.

```js
import {
  ARG,
  FUNCTION_TYPE,
  Interpreter,
  VMachine,
} from '@tardo/trash';

const interpreter = new Interpreter();
const vmachine = new VMachine({
  maxInstructions: 100_000,
  maxCollectionLength: 100_000,
  maxStringLength: 1_000_000,
  processCommandJob: async ({cmdName, kwargs}) => {
    if (cmdName !== 'notify') {
      throw new Error(`Unknown host command: ${cmdName}`);
    }
    return `${kwargs.message} (${kwargs.repeat} times)`;
  },
});

vmachine.registerCommand('notify', {
  type: FUNCTION_TYPE.Command,
  args: [
    [ARG.String, ['m', 'message'], true, 'Message to show'],
    [ARG.Number, ['r', 'repeat'], false, 'Number of repetitions', 1],
  ],
});

const source = `
  $total = 0
  for ($value in [1, 2, 3, 4]) {
    $total += $value * $value
  }
  notify -m 'Total of squares: ' + $total -r 2
`;

const program = interpreter.parse(source, {
  registeredCmds: vmachine.getRegisteredCmds(),
});
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 1000);
try {
  const result = await vmachine.execute(program, {signal: controller.signal});
  console.log(result); // Total of squares: 30 (2 times)
} finally {
  clearTimeout(timer);
}
```

`processCommandJob` is the boundary between TraSH and the host application. Validate and perform all side effects there,
such as database writes, navigation, or API calls.

The default budget is 1,000,000 instructions; this example lowers it to 100,000. Collection and string limits default to
100,000 items and 1,000,000 UTF-16 code units. Cancellation is cooperative: host operations must also honor the `signal`
received by `processCommandJob`. See the [runtime contract](docs/runtime.md#execution-limits-and-cancellation) for
details.

## Translations

TraSH has no translation dependency. By default, messages use their English fallback and interpolate `{{values}}`.
Install any translator through `setTranslator`; for example, `setTranslator(i18next.t.bind(i18next))` when using
`i18next` in the host application. Call `setTranslator()` to restore the default behavior.

```js
import {setTranslator} from '@tardo/trash';

setTranslator((key, fallback, values) => myTranslator.translate(key, {fallback, ...values}));
```

## Basic TraSH usage

```trash
$user = {name: 'Ada', scores: [10, 8, 9]}
$total = 0
for ($score in $user['scores']) {
  $total += $score
}

if ($total >= 25) {
  return 'passed: ' + $user['name']
}
return 'pending'
```

- Variables begin with `$`; `$name` reads a value, including a function. `$$name` invokes a function; see the
  [compatibility rules](docs/runtime.md#variables-and-functions) for its use in argument position.
- Calls accept positional arguments, `-short` arguments, and `--long` arguments.
- Wrap a command call that is part of an expression in parentheses.
- `silent command ...` returns `null` if its execution callback throws, unless execution uses `throwSilentErrors: true`.
  Argument validation and execution-control errors still propagate; see the
  [error rules](docs/runtime.md#syntax-and-errors).

## Plugins

Plugins register internal commands through a small API instead of receiving the runtime. They can define commands,
validate arguments with `ARG`, invoke script callbacks, and validate safe dictionary keys.

```js
import {ARG} from '@tardo/trash/plugin';

const registerDouble = api => {
  api.registerCommand('double', {
    args: [[ARG.Number, ['v', 'value'], true, 'Value to double']],
    callback: async (_context, {value}) => value * 2,
  });
};

vmachine.use(registerDouble);
```

## Deep imports

Deep imports are supported for individual core modules:

```js
import VMachine from '@tardo/trash/vmachine';
```

## Development and contributing

The development setup, testing workflow, style rules, and pull request process are documented in
[docs/contributing.md](docs/contributing.md).

## License

[MIT](LICENSE)
