# Getting started with TraSH

This guide takes you from an empty folder to a running TraSH program. You do not need to know how the interpreter is implemented. You do need to know that TraSH is embedded in a JavaScript application, and that application decides what each script is allowed to do.

## The mental model

TraSH separates a program into two parts:

1. **The JavaScript host** registers commands, validates their arguments, and performs real operations such as reading data or sending a notification.
2. **The TraSH script** combines those commands with variables, expressions, functions, and control flow.

A script does not automatically get access to JavaScript, Node.js, files, or the network. It can only use capabilities registered by the host. The flow is:

```text
TraSH source → Interpreter.parse → VMachine.execute → host command → result to script
```

## 1. Set up a project

You need Node.js and npm. Create a folder, initialize a project, and install TraSH:

```sh
mkdir my-first-trash
cd my-first-trash
npm init -y
npm install @tardo/trash
```

Save the following example as `first-program.mjs`. The `.mjs` extension lets Node.js use `import` directly.

## 2. Write a complete program

```js
import {ARG, Interpreter, VMachine} from '@tardo/trash';

// The machine delegates application operations to this function.
const vmachine = new VMachine({
  processCommandJob: async ({cmdName, kwargs}) => {
    if (cmdName === 'notify') {
      console.log(kwargs.message);
      return kwargs.message;
    }
    throw new Error(`Unknown command: ${cmdName}`);
  },
});

// Register commands before parsing TraSH source.
vmachine.registerCommand('notify', {
  args: [[ARG.String, ['m', 'message'], true, 'Message to display']],
});

const source = `
  $total = 0

  for ($value in [1, 2, 3, 4]) {
    $total += $value * $value
  }

  notify -m 'The sum of squares is ' + $total
`;

const interpreter = new Interpreter();
const program = interpreter.parse(source, {
  registeredCmds: vmachine.getRegisteredCmds(),
});
const result = await vmachine.execute(program);

console.log('Program result:', result);
```

Run it from the project folder:

```sh
node first-program.mjs
```

You will see `The sum of squares is 30`, followed by the value returned by the last command.

## 3. Understand the pieces

### Register capabilities

`registerCommand` makes a name available to TraSH. In this example, `notify` takes a string argument, identified in the script as either `-m` or `--message`.

`processCommandJob` receives the validated call and decides what to do. Treat command names and arguments from scripts as input: validate and authorize real operations in the host.

Argument types include `ARG.String`, `ARG.Number`, `ARG.Flag`, `ARG.Dictionary`, `ARG.List`, and `ARG.Any`. See [Functions and extensions](functions.md#define-arguments) for combined types, optional values, and plugins.

### Parse and execute

`Interpreter.parse` compiles the source into a program. Pass it the registered commands so the parser can recognize calls. Then `vmachine.execute(program)` runs the program and dispatches its commands through `processCommandJob`.

When running the same source repeatedly, register commands once and reuse the result of `parse`. Parse again if command definitions change.

### Read the script

- Variables start with `$`: `$total = 0` creates or updates a variable.
- Values include strings (`'hello'`), numbers, `true`, `false`, `null`, `undefined`, lists (`[1, 2]`), and dictionaries (`{name: 'Ada'}`).
- `for ($value in [1, 2, 3])` iterates over a list; `if (...) { ... }` runs a block conditionally.
- `+` adds numbers or joins strings; `+=` updates a variable. Other operators include `-`, `*`, `/`, `%`, comparisons, `&&`, `||`, and `!`.
- Blocks use braces. Instructions can be separated by newlines or `;`.
- Commands accept positional, short, or long arguments, for example `notify 'hello'`, `notify -m 'hello'`, and `notify --message 'hello'`.

Wrap a command call in parentheses when using it inside an expression, for example `$message = (notify -m 'Hello')`. Strings can use single or double quotes. Comments start with `//` or `/* ... */` outside strings.

## 4. Extend the script

TraSH functions let you reuse logic and accept parameters:

```trash
function sum_values(values) {
  $total = 0
  for ($value in $values) {
    $total += $value
  }
  return $total
}

$numbers = [1, 2, 3]
$sum = (sum_values $numbers)
```

Functions can return a value with `return`. You can also use `elif`, `else`, `break`, and `continue`. Parameters can have type annotations (`Number`, `String`, `List`, `Dictionary`, `Flag`, `Any`) and default values; see [TraSH functions](functions.md#1-functions-declared-in-trash) for more examples.

## Next steps

- [Functions and extensions](functions.md): functions, plugins, host commands, and arguments.
- [Create your first plugin](first-plugin.md): expose a JavaScript helper as a TraSH command.
- [Runtime contract](runtime.md): scopes, property access, execution limits, and errors.
- [README](../README.md): installation, a complete example, translations, and plugins.

If you run scripts from users you do not control, read [execution limits and cancellation](runtime.md#execution-limits-and-cancellation) first: TraSH's limits are not a substitute for process isolation.
