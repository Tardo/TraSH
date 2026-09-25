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
value without calling it, for example to a plugin callback:

```trash
$double = function (value: Number) {
  return $value * 2
}

```

Function parameter types are `String`, `Number`, `Dictionary`, `Flag`, `Any`,
and `List`. Use `|` for a union, such as `String|Number`. A parameter without a
type annotation is `Any`.

## 2. Plugins

A plugin runs internal functions without access to the virtual machine, frames,
or execution options. Use it to expose JavaScript capabilities that do not need
the host command layer. For a complete example from project setup to execution,
see [Create your first TraSH plugin](first-plugin.md).

```js
import {ARG} from '@tardo/trash/plugin';

const registerSlugify = api => {
  api.registerCommand('slugify', {
    args: [[ARG.String, ['v', 'value'], true, 'Text to transform']],
    callback: async (_context, {value}) => value.trim().toLowerCase().replaceAll(' ', '-'),
  });
};

vmachine.use(registerSlugify);

await evaluate("slugify ' Hello TraSH '"); // 'hello-trash'
```

The callback signature is:

```js
async (context, kwargs) => result
```

- `kwargs` holds validated and normalized arguments under their long names. A
  hyphen in an argument name becomes an underscore.
- Use `context.callFunction(fn, values)` to call a TraSH function received as an
  argument. It retains the current execution controls and error policy.
- Use `context.propertyKey(key)` before reading or writing a script-provided
  dictionary key.
- The result, including a `Promise`, is returned to the script.

This internal function consumes a callback:

```js
const registerTwice = api => {
  api.registerCommand('twice', {
    args: [
      [ARG.Any, ['v', 'value'], true, 'Initial value'],
      [ARG.Any, ['f', 'transform'], true, 'TraSH function'],
    ],
    callback: async ({callFunction}, {value, transform}) => {
      const first = await callFunction(transform, [value]);
      return callFunction(transform, [first]);
    },
  });
};

vmachine.use(registerTwice);

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
`kwargs`, `args`, `signal`, and `executionOptions`. When delegating to another
`vmachine.execute(...)` call, forward `executionOptions` to preserve the error
policy, cancellation signal, aliases, and shared instruction budget. Pass the
same options object to retain the shared budget. The second argument states
whether the call is silent (through syntax or execution options). Treat
script-provided data as untrusted input, then apply application-specific
validation and authorization before producing side effects.

Mark an internal function or command as `unsafe: true` when it requires an
explicit confirmation. When the virtual machine receives `confirmUnsafe`, it
calls it before execution.

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
