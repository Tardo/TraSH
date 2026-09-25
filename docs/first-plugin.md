# Create your first TraSH plugin

A plugin adds JavaScript functionality to a TraSH virtual machine as an internal command. This guide creates a `slugify` command, registers it, and calls it from a script.

## 1. Create a project

If you already followed the [getting started guide](getting-started.md), use that project. Otherwise, create one and install TraSH:

```sh
mkdir my-first-plugin
cd my-first-plugin
npm init -y
npm install @tardo/trash
```

Create `text-plugin.mjs`:

```js
import {ARG} from '@tardo/trash/plugin';

export default function textPlugin(api) {
  api.registerCommand('slugify', {
    definition: 'Turn text into a lowercase, hyphen-separated slug',
    args: [[ARG.String, ['v', 'value'], true, 'Text to convert']],
    callback: async (_context, {value}) =>
      value.trim().toLowerCase().replace(/\s+/g, '-'),
  });
}
```

The plugin receives a small `api` object with `registerCommand`. The command definition declares its argument; TraSH validates it and gives the callback the normalized value under its long name, `value`.

## 2. Register and use the plugin

Create `first-plugin.mjs`:

```js
import {Interpreter, VMachine} from '@tardo/trash';
import textPlugin from './text-plugin.mjs';

const vmachine = new VMachine({
  // Required by VMachine; this example uses only an internal plugin command.
  processCommandJob: async ({cmdName}) => {
    throw new Error(`Unexpected host command: ${cmdName}`);
  },
});

vmachine.use(textPlugin);

const interpreter = new Interpreter();
const source = "slugify --value ' Hello TraSH Plugin '";
const program = interpreter.parse(source, {
  registeredCmds: vmachine.getRegisteredCmds(),
});

const result = await vmachine.execute(program);
console.log(result); // hello-trash-plugin
```

Run the example:

```sh
node first-plugin.mjs
```

Register plugins before parsing source: the parser uses the registered command names to recognize calls. `vmachine.use(textPlugin)` invokes the plugin and registers `slugify` as an internal command.

## 3. Use arguments and results

The `args` list describes each argument as:

```js
[type, [shortName, longName], required, description, defaultValue?, strictValues?]
```

The example defines a required string named `value`, with `-v` and `--value` spellings. Scripts can call it positionally or by name:

```trash
slugify 'Hello TraSH Plugin'
slugify -v 'Hello TraSH Plugin'
slugify --value 'Hello TraSH Plugin'
```

The callback receives `(context, kwargs)`. `kwargs` contains validated arguments under their long names; a hyphen in a long name becomes an underscore. Its returned value, including a promise result, becomes the TraSH command result.

Plugins are for internal functionality that does not need the host command layer. The callback does not receive the VM, variable frames, or execution options. It can use these helpers from `context` when needed:

- `context.callFunction(fn, values)` invokes a TraSH function passed to the plugin, preserving execution controls.
- `context.propertyKey(key)` validates a script-provided dictionary key before property access.
- `context.signal` is the current cancellation signal, if one was supplied.

For persistence, authorization, or other host-controlled side effects, use a host-delegated command instead. See [Functions and extensions](functions.md) for more on plugin callbacks, argument types, and host commands.
