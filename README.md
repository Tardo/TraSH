<h1 align="center">
  <div>TraSH</div>

[![Tests](https://github.com/Tardo/TraSH/actions/workflows/tests.yml/badge.svg)](https://github.com/Tardo/TraSH/actions/workflows/tests.yml)
</h1>

TraSH is a scripting language for embedding expressions and commands in a JavaScript application. Scripts run through
its own parser and virtual machine — **no JavaScript `eval()`**. It includes a standard library for arrays,
dictionaries, strings, math, encoding, time, and HTTP requests.

Execution has a configurable instruction budget and supports `AbortSignal` cancellation. See the
[runtime contract](docs/runtime.md) for property isolation, scope rules, compatibility changes, and the limits of these
controls.

## Installation

```sh
npm install @tardo/trash
```

The package is ESM, so consumers must use `import` or `.mjs` files.

## Flow

The package includes `.mjs.flow` files generated from its typed source during the build. Flow discovers them
automatically, including for deep imports.

```js
import type {CMDDef, VMachineOptions} from '@tardo/trash';
import type {ProcessCommandJobOptions} from '@tardo/trash/vmachine';
```

## Complete example

The following program registers the whole standard library, declares a TraSH function, and delegates the `notify`
command to the JavaScript host. Save it as `example.mjs` and run `node example.mjs`.

```js
import {
  ARG,
  FUNCTION_TYPE,
  Interpreter,
  VMachine,
  registerArr,
  registerDict,
  registerEnde,
  registerMath,
  registerNet,
  registerStr,
  registerTime,
} from '@tardo/trash';

const interpreter = new Interpreter();
const vmachine = new VMachine({
  processCommandJob: async ({cmdName, kwargs}) => {
    if (cmdName !== 'notify') {
      throw new Error(`Unknown host command: ${cmdName}`);
    }
    return `${kwargs.message} (${kwargs.repeat} times)`;
  },
});

[registerArr, registerDict, registerEnde, registerMath, registerNet, registerStr, registerTime].forEach(register =>
  register(vmachine),
);

vmachine.registerCommand('notify', {
  type: FUNCTION_TYPE.Command,
  args: [
    [ARG.String, ['m', 'message'], true, 'Message to show'],
    [ARG.Number, ['r', 'repeat'], false, 'Number of repetitions', 1],
  ],
});

const source = `
  $square = function (value: Number) {
    return $value * $value
  }

  $values = [1, 2, 3, 4]
  $squares = (arr_map $values $$square)
  $total = (arr_reduce $squares 0 (function (sum, value) {
    return $sum + $value
  }))
  notify -m ('Total of squares: ' + $total) -r 2
`;

const program = interpreter.parse(source, {
  registeredCmds: vmachine.getRegisteredCmds(),
});
const result = await vmachine.execute(program);

console.log(result); // Total of squares: 30 (2 times)
```

`processCommandJob` is the boundary between TraSH and the host application. Validate and perform all side effects there,
such as database writes, navigation, or API calls.

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
$total = (arr_reduce $user['scores'] 0 (function (sum, score) {
  return $sum + $score
}))

if ($total >= 25) {
  return (str_upper ('passed: ' + $user['name']))
}
return 'pending'
```

- Variables begin with `$`; `$name` reads a value, including a function. `$$name` invokes a function; see the
  [compatibility rules](docs/runtime.md#variables-and-functions) for its use in argument position.
- Calls accept positional arguments, `-short` arguments, and `--long` arguments.
- Wrap a call that is part of an expression in parentheses: `(dict_get $user 'name')`.
- `silent command ...` suppresses an error from that call and returns `null` in that error case.

## Standard library

Register only the modules you need, or register them all as in the complete example.

| Register       | Functions                                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `registerArr`  | `arr_clone`, `arr_append`, `arr_prepend`, `arr_join`, `arr_map`, `arr_filter`, `arr_reduce`                                            |
| `registerDict` | `dict_keys`, `dict_values`, `dict_entries`, `dict_has`, `dict_get`, `dict_set`, `dict_remove`, `dict_merge`, `dict_clone`, `dict_size` |
| `registerStr`  | `str_split`, `str_upper`, `str_lower`, `str_trim`, `str_replace`, `str_slice`, `str_includes`, `str_starts`, `str_ends`                |
| `registerMath` | `floor`, `fixed`, `rand`, `abs`, `pow`                                                                                                 |
| `registerEnde` | `encode`, `decode`                                                                                                                     |
| `registerTime` | `sleep`, `pnow`                                                                                                                        |
| `registerNet`  | `fetch`                                                                                                                                |

See [docs/functions.md](docs/functions.md) for function signatures, side effects, and instructions for extending the
language.

## Deep imports

Deep imports are supported when registering the entire package would be unnecessary:

```js
import VMachine from '@tardo/trash/vmachine';
import registerMath from '@tardo/trash/core/math/__all__';
```

## Development and contributing

The development setup, testing workflow, style rules, and pull request process are documented in
[docs/contributing.md](docs/contributing.md).

## License

[MIT](LICENSE)
