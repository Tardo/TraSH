# Functions and extensions

TraSH runs three function types. They are all registered in the same virtual
machine, so scripts invoke them with the same syntax.

| Type | Implemented in | Use it for |
| --- | --- | --- |
| `FUNCTION_TYPE.Native` | TraSH | Logic written by the script author. |
| `FUNCTION_TYPE.Internal` | JavaScript | Synchronous or asynchronous language extensions. |
| `FUNCTION_TYPE.Command` | Host through `processCommandJob` | Effects controlled by the host application. |

## Set up the interpreter

Every example starts with this minimal setup. Register commands before calling
`parse`, because the parser uses registered commands to recognize calls and
aliases.

```js
import {Interpreter, VMachine} from '@tardo/trash';

const interpreter = new Interpreter();
const vmachine = new VMachine({
  silent: false,
  processCommandJob: async ({cmdName}) => {
    throw new Error(`Host command not implemented: ${cmdName}`);
  },
});

const evaluate = source =>
  vmachine.execute(
    interpreter.parse(source, {registeredCmds: vmachine.getRegisteredCmds()}),
    {aliases: {}, isData: false, silent: false},
  );
```

The virtual machine retains global variables between executions. Call
`vmachine.cleanGlobals()` to start a clean session. To isolate one execution,
pass a `Frame` as the third `execute` argument. The command registry remains shared;
use separate VMs for independent sessions. See the [runtime contract](runtime.md)
for execution limits, cancellation, scopes and property access rules.

## 1. Functions declared in TraSH

Functions declared in a script are `Native` functions. Their names are
registered automatically, and their parameters can have a type, a type union,
and a default value.

```trash
function greeting(name: String, suffix: String = '!') {
  return 'Hello, ' + $name + $suffix
}

greeting 'Ada'
```

An anonymous function can be stored in a variable. Use `$` to pass the function
value without calling it, for example to a higher-order function:

```trash
$double = function (value: Number) {
  return $value * 2
}

arr_map [1, 2, 3] $double
```

Function parameter types are `String`, `Number`, `Dictionary`, `Flag`, `Any`,
and `List`. Use `|` for a union, such as `String|Number`. A parameter without a
type annotation is `Any`.

## 2. Internal JavaScript functions

An `Internal` function runs directly in the virtual machine. Use it to expose a
JavaScript capability that does not need the host command layer.

```js
import {ARG, FUNCTION_TYPE} from '@tardo/trash';

vmachine.registerCommand('slugify', {
  type: FUNCTION_TYPE.Internal,
  args: [[ARG.String, ['v', 'value'], true, 'Text to transform']],
  callback: async (_vmachine, {value}) => value.trim().toLowerCase().replaceAll(' ', '-'),
});

await evaluate("slugify ' Hello TraSH '"); // 'hello-trash'
```

The callback signature is:

```js
async (vmachine, kwargs, frame, options) => result
```

- `kwargs` holds validated and normalized arguments under their long names. A
  hyphen in an argument name becomes an underscore.
- `frame` and `options` are needed by higher-order functions. Use
  `vmachine.callFunctionValue(fn, values, frame, options)` to call a TraSH
  function received as an argument.
- The result, including a `Promise`, is returned to the script.

This internal function consumes a callback:

```js
vmachine.registerCommand('twice', {
  type: FUNCTION_TYPE.Internal,
  args: [
    [ARG.Any, ['v', 'value'], true, 'Initial value'],
    [ARG.Any, ['f', 'transform'], true, 'TraSH function'],
  ],
  callback: async (vmachine, {value, transform}, frame, options) => {
    const first = await vmachine.callFunctionValue(transform, [value], frame, options);
    return vmachine.callFunctionValue(transform, [first], frame, options);
  },
});

await evaluate(`
  $increment = function (value: Number) { return $value + 1 }
  twice 3 $$increment
`); // 5
```

## 3. Host-delegated commands

`Command` functions do not execute their `callback`. The virtual machine
validates their arguments and calls `processCommandJob`, where the application
decides what to do. This is the correct place for persistence, navigation,
integrations, and authorization.

```js
import {ARG, FUNCTION_TYPE, Interpreter, VMachine} from '@tardo/trash';

const saved = [];
const interpreter = new Interpreter();
const vmachine = new VMachine({
  silent: false,
  processCommandJob: async ({cmdName, kwargs}, silent) => {
    if (cmdName !== 'save_note') {
      throw new Error(`Unknown host command: ${cmdName}`);
    }
    saved.push(kwargs.text);
    return silent ? null : {id: saved.length, text: kwargs.text};
  },
});

vmachine.registerCommand('save_note', {
  type: FUNCTION_TYPE.Command,
  args: [[ARG.String, ['t', 'text'], true, 'Note text']],
});

const program = interpreter.parse("save_note -t 'Buy coffee'", {
  registeredCmds: vmachine.getRegisteredCmds(),
});
await vmachine.execute(program, {aliases: {}, isData: false, silent: false});
```

The first `processCommandJob` argument contains `cmdName`, `cmdRaw`, `cmdDef`,
`kwargs`, and `args`. The second states whether the call used `silent`. Treat
script-provided data as untrusted input, then apply application-specific
validation and authorization before producing side effects.

Mark an internal function or command as `unsafe: true` when it requires an
explicit confirmation. When the virtual machine receives `confirmUnsafe`, it
calls it before execution; the standard-library `fetch` function already uses
this protection.

```js
const vmachine = new VMachine({
  silent: false,
  confirmUnsafe: async (cmdName, cmdRaw) => window.confirm(`Run ${cmdName}?\n${cmdRaw}`),
  processCommandJob: async () => null,
});
```

## Define arguments

The `args` field of an internal function or command is a tuple list:

```js
[type, [shortName, longName], required, description, defaultValue?, strictValues?]
```

```js
args: [
  [ARG.String, ['n', 'name'], true, 'Display name'],
  [ARG.Number, ['l', 'limit'], false, 'Maximum items', 10],
  [ARG.Flag, ['a', 'all'], false, 'Include archived items'],
  [ARG.List | ARG.String, ['t', 'tag'], false, 'Tags'],
  [ARG.String | ARG.Number, ['i', 'id'], true, 'Identifier'],
]
```

| Type | Accepted values |
| --- | --- |
| `ARG.String` | Strings. Command-line arguments are converted to strings. |
| `ARG.Number` | Numbers. Command-line arguments are converted with `Number`. |
| `ARG.Dictionary` | Object literals such as `{id: 1}`. |
| `ARG.Flag` | Booleans; enabled by including the argument without a value. |
| `ARG.Any` | Any TraSH value. |
| `ARG.List | T` | An array whose elements are type `T`. Use `ARG.List | ARG.Any` for mixed arrays. |
| `A | B` | A union of types `A` and `B`. |

Arguments can be positional, short named, or long named:

```trash
save_note 'Buy coffee'
save_note -t 'Buy coffee'
save_note --text 'Buy coffee'
```

Lists use `[1, 2]`; comma-separated text for a list argument is also converted
to a list. `strictValues` is preserved as definition metadata, but the virtual
machine does not validate it. Validate those restrictions in the host function
when needed.

Use letters, digits, and underscores for command names, such as `save_note`.
Hyphens belong to argument flags, not command names.

## Standard library

Register each group with the export shown in the README. Bracketed arguments
are optional. Functions that mutate their input say so explicitly.

### Arrays

| Function | Signature | Result |
| --- | --- | --- |
| `arr_clone` | `arr_clone arr` | Shallow copy of `arr`. |
| `arr_append` | `arr_append arr item` | Appends `item` and mutates `arr`. |
| `arr_prepend` | `arr_prepend arr item` | Prepends `item` and mutates `arr`. |
| `arr_join` | `arr_join arr [sep]` | Joins elements with `sep`, defaulting to `''`. |
| `arr_map` | `arr_map arr mapper` | New array from `mapper(item)`. |
| `arr_filter` | `arr_filter arr filter` | New array whose elements make `filter(item)` true. |
| `arr_reduce` | `arr_reduce arr initial reducer` | Accumulator from `reducer(accumulator, item)`. |

### Dictionaries

| Function | Signature | Result |
| --- | --- | --- |
| `dict_keys` | `dict_keys dict` | Dictionary keys. |
| `dict_values` | `dict_values dict` | Dictionary values. |
| `dict_entries` | `dict_entries dict` | `[key, value]` pairs. |
| `dict_has` | `dict_has dict key` | Whether an own key exists. |
| `dict_get` | `dict_get dict key [default]` | Value or `default` when absent. |
| `dict_set` | `dict_set dict key value` | Assigns and mutates `dict`. |
| `dict_remove` | `dict_remove dict key` | Deletes the key and mutates `dict`. |
| `dict_merge` | `dict_merge dict other` | New dictionary; `other` wins. |
| `dict_clone` | `dict_clone dict` | Shallow copy of `dict`. |
| `dict_size` | `dict_size dict` | Number of own keys. |

### Strings

| Function | Signature | Result |
| --- | --- | --- |
| `str_split` | `str_split str [delim]` | Splits `str`; `delim` defaults to `''`. |
| `str_upper` | `str_upper str` | Converts to uppercase. |
| `str_lower` | `str_lower str` | Converts to lowercase. |
| `str_trim` | `str_trim str` | Removes leading and trailing whitespace. |
| `str_replace` | `str_replace str search replacement [-a]` | Replaces the first match, or all matches with `-a`. |
| `str_slice` | `str_slice str begin [end]` | Extracts from `begin` to exclusive `end`; accepts negative indexes. |
| `str_includes` | `str_includes str needle` | Checks for a substring. |
| `str_starts` | `str_starts str prefix` | Checks the prefix. |
| `str_ends` | `str_ends str suffix` | Checks the suffix. |

### Math, encoding, and time

| Function | Signature | Result |
| --- | --- | --- |
| `floor` | `floor num` | Rounds down. |
| `fixed` | `fixed num [decimals]` | Calls `toFixed(decimals)` and truncates the result to an integer. |
| `rand` | `rand min max` | Inclusive random integer between the limits. |
| `abs` | `abs num` | Absolute value. |
| `pow` | `pow base exponent` | Exponentiation. |
| `encode` | `encode value -m b64` | Base64-encodes a value. |
| `decode` | `decode value -m b64` | Base64-decodes a value. |
| `sleep` | `sleep [-t milliseconds]` | Asynchronous delay. |
| `pnow` | `pnow` | High-resolution timestamp in milliseconds. |

### Network

| Function | Signature | Result |
| --- | --- | --- |
| `fetch` | `fetch url [-o options] [-t timeout]` | Runs `fetch`; returns the response or `null` on timeout. |

`fetch` is marked `unsafe`. Its options are the native `fetch` options object,
and `timeout` is in milliseconds.

## Useful syntax

```trash
$data = {name: 'Ada', values: [1, 2, 3]}
$data['values'][0] += 1

if ($data['name'] == 'Ada' && $data['values']['length'] > 0) {
  return true
} elif (false) {
  return false
} else {
  return null
}
```

- Available literals are single- or double-quoted strings, numbers, `true`,
  `false`, `null`, `undefined`, arrays, and dictionaries.
- Operators are `+`, `-`, `*`, `/`, `%`, `==`, `!=`, `>`, `<`, `>=`, `<=`,
  `&&`, `||`, and `!`; `?:`, `++`, and `--` are also available.
- Both `for (init; condition; step)` and `for ($item in iterable)` are
  supported, together with `break` and `continue`.
- Missing properties return `undefined`. On arrays, a nonnumeric lookup projects
  that property from every item when it exists.
