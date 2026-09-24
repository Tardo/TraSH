import {ARG, FUNCTION_TYPE, Interpreter, VMachine} from '@tardo/trash';

function setup(options = {}) {
  const interpreter = new Interpreter();
  const vm = new VMachine({processCommandJob: async () => null, ...options});
  vm.use(api => {
    api.registerCommand('property_get', {
      args: [
        [ARG.Any, ['v', 'value'], true, 'Value'],
        [ARG.Any, ['k', 'key'], true, 'Property key'],
      ],
      callback: async ({propertyKey}, {value, key}) => value[propertyKey(key)],
    });
    api.registerCommand('property_set', {
      args: [
        [ARG.Any, ['v', 'value'], true, 'Value'],
        [ARG.Any, ['k', 'key'], true, 'Property key'],
        [ARG.Any, ['i', 'item'], true, 'Value to set'],
      ],
      callback: async ({propertyKey}, {value, key, item}) => {
        value[propertyKey(key)] = item;
        return value;
      },
    });
    api.registerCommand('invoke', {
      args: [
        [ARG.Any, ['f', 'fn'], true, 'Function'],
        [ARG.Any, ['v', 'value'], false, 'Value'],
      ],
      callback: async ({callFunction}, {fn, value}) => callFunction(fn, value === undefined ? [] : [value]),
    });
  });
  const parse = source => interpreter.parse(source, {registeredCmds: vm.getRegisteredCmds()});
  const run = async (source, opts) => vm.execute(parse(source), opts);
  return {interpreter, vm, parse, run};
}

test.each(['__proto__', 'constructor', 'prototype'])(
  'blocks reserved property %s through every access path',
  async key => {
    const {run} = setup();
    for (const source of [
      `$d = {}; $d['${key}']`,
      `$d = {}; $d['${key}'] = {polluted: true}`,
      `$d = {}; $d['${key}'] += 1`,
      `$d = {}; $d['${key}'] -= 1`,
      `$d = {}; $d['${key}'] *= 1`,
      `$d = {}; $d['${key}'] /= 1`,
      `{'${key}': 1}`,
      `property_set {} '${key}' 1`,
      `property_get {} '${key}'`,
      `$a = [{}]; $a['${key}']`,
    ]) {
      await expect(run(source)).rejects.toThrow();
    }
    expect({}.polluted).toBeUndefined();
  },
);

test('reads only own properties and preserves array projections and string indexing', async () => {
  const {run, vm} = setup();
  vm.registerCommand('record', {
    type: FUNCTION_TYPE.Internal,
    callback: async () => Object.assign(Object.create({inherited: 42}), {own: 7}),
  });
  await expect(run("$d = (record); [$d['inherited'], $d['own']]")).resolves.toEqual([undefined, 7]);
  await expect(run("$a = [null, {name: 'Ada'}, {}]; $a['name']")).resolves.toEqual([undefined, 'Ada', undefined]);
  await expect(run("$s = 'abc'; [$s['length'], $s[1]]")).resolves.toEqual([3, 'b']);
});

test('special variable names do not change frame prototypes', async () => {
  await expect(setup().run('$__proto__ = 7; $__proto__')).resolves.toBe(7);
});

test('the original prototype pollution exploit cannot reach the host', async () => {
  try {
    await expect(setup().run("$d = {}; $d['__proto__']['trash_review_probe'] = 123")).rejects.toThrow();
    expect({}.trash_review_probe).toBeUndefined();
  } finally {
    delete Object.prototype.trash_review_probe;
  }
});

test.each([
  'for ($i = 0; true; $i++) { $i + 1 }',
  'function spin() { for ($i = 0; true; $i++) { $i + 1 } }; silent spin',
  'function again() { again }; again',
  'function spin() { for ($i = 0; true; $i++) { $i + 1 } }; function use(x = (spin)) { return $x }; silent use',
  'invoke (function (x) { for ($i = 0; true; $i++) { $i + 1 } }) 1',
])('shares the instruction budget across nested execution: %s', async source => {
  await expect(setup({maxInstructions: 200}).run(source)).rejects.toThrow('Instruction limit exceeded');
});

test('budgets reset for new executions and are independent during concurrent calls', async () => {
  const {run} = setup({maxInstructions: 3});
  await expect(run('1; 2; 3; 4')).rejects.toThrow('Instruction limit exceeded');
  await expect(Promise.all([run('1'), run('2')])).resolves.toEqual([1, 2]);
  await expect(run('1; 2; 3; 4', {maxInstructions: 20})).resolves.toBe(4);
});

test.each([0, -1, Infinity, NaN, 1.5])('rejects invalid instruction budget %s', async limit => {
  await expect(setup({maxInstructions: limit}).run('1')).rejects.toThrow(RangeError);
});

test('cancels a running CPU-only loop from a timer', async () => {
  const {run} = setup({maxInstructions: 100_000_000});
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 0);
  try {
    await expect(run('for ($i = 0; true; $i++) { $i + 1 }', {signal: controller.signal})).rejects.toThrow(
      'Execution aborted',
    );
  } finally {
    clearTimeout(timer);
  }
});

test('pre-aborted execution does not perform side effects', async () => {
  let called = false;
  const {run, vm} = setup({
    processCommandJob: async () => {
      called = true;
    },
  });
  vm.registerCommand('side_effect', {});
  const controller = new AbortController();
  controller.abort();
  await expect(run('side_effect', {signal: controller.signal})).rejects.toThrow('Execution aborted');
  expect(called).toBe(false);
});

test('cancellation during unsafe confirmation prevents the callback', async () => {
  const controller = new AbortController();
  let called = false;
  const {run, vm} = setup({
    confirmUnsafe: async () => {
      controller.abort();
      return true;
    },
    processCommandJob: async () => {
      called = true;
    },
  });
  vm.registerCommand('side_effect', {unsafe: true});
  await expect(run('side_effect', {signal: controller.signal})).rejects.toThrow('Execution aborted');
  expect(called).toBe(false);
});

test('host commands receive the execution cancellation signal', async () => {
  const controller = new AbortController();
  const {run, vm} = setup({processCommandJob: async ({signal}) => signal === controller.signal});
  vm.registerCommand('check_signal', {});
  await expect(run('check_signal', {signal: controller.signal})).resolves.toBe(true);
});

test('plugins receive the execution cancellation signal', async () => {
  const controller = new AbortController();
  const {run, vm} = setup();
  vm.use(api => {
    api.registerCommand('check_signal', {
      callback: async ({signal}) => signal === controller.signal,
    });
  });
  await expect(run('check_signal', {signal: controller.signal})).resolves.toBe(true);
});

test('silent suppresses host callback errors consistently', async () => {
  const {run, vm} = setup({
    processCommandJob: async () => {
      throw new Error('host failed');
    },
  });
  vm.registerCommand('fail', {});
  await expect(run('silent fail')).resolves.toBeNull();
  await expect(run('fail')).rejects.toThrow('host failed');
});

test.each([FUNCTION_TYPE.Command, FUNCTION_TYPE.Internal, FUNCTION_TYPE.Native])(
  'propagates silent callback errors by execution policy for function type %s',
  async type => {
    const error = new Error('callback failed');
    const fail = async () => {
      throw error;
    };
    const {run, vm, parse} = setup({processCommandJob: fail});
    vm.registerCommand('fail', {type, callback: fail});
    await expect(run('fail', {silent: true})).resolves.toBeNull();
    await expect(run('fail', {silent: true, throwSilentErrors: true})).rejects.toBe(error);
    await expect(run('silent fail', {throwSilentErrors: true})).rejects.toBe(error);
    await expect(run('function nested() { silent fail }; nested', {throwSilentErrors: true})).rejects.toBe(error);
    await expect(vm.execute(parse('fail'), {silent: true, throwSilentErrors: true}, undefined, true)).rejects.toBe(
      error,
    );
    await expect(run('fail', {silent: true})).resolves.toBeNull();
  },
);

test('keeps concurrent silent error policies independent', async () => {
  const error = new Error('callback failed');
  let release;
  const gate = new Promise(resolve => {
    release = resolve;
  });
  const {run, vm} = setup({
    processCommandJob: async () => {
      await gate;
      throw error;
    },
  });
  vm.registerCommand('fail', {});
  const strict = expect(run('fail', {silent: true, throwSilentErrors: true})).rejects.toBe(error);
  const legacy = expect(run('fail', {silent: true})).resolves.toBeNull();
  release();
  await Promise.all([strict, legacy]);
});

test('host-delegated executions retain options and share the instruction budget', async () => {
  const error = new Error('callback failed');
  const controller = new AbortController();
  const {run, vm, parse} = setup({
    processCommandJob: async ({cmdName, executionOptions}, silent) => {
      expect(silent).toBe(true);
      expect(executionOptions.signal).toBe(controller.signal);
      expect(executionOptions.throwSilentErrors).toBe(true);
      if (cmdName === 'fail') throw error;
      return vm.execute(parse(cmdName === 'delegate' ? 'fail' : 'recurse'), executionOptions);
    },
  });
  for (const name of ['fail', 'delegate', 'recurse']) vm.registerCommand(name, {});
  const options = {silent: true, throwSilentErrors: true, signal: controller.signal, maxInstructions: 100};
  await expect(run('delegate', options)).rejects.toBe(error);
  await expect(run('recurse', options)).rejects.toThrow('Instruction limit exceeded');
});

test('required arguments are checked even when none are supplied', async () => {
  await expect(setup().run('property_get')).rejects.toThrow();
});

test('higher-order callbacks validate argument types and apply defaults', async () => {
  const {run} = setup();
  await expect(run("invoke (function (x: Number) { return $x }) 'wrong'")).rejects.toThrow();
  await expect(run('invoke (function (x, y = 10) { return $x + $y }) 1')).resolves.toBe(11);
  await expect(run('$f = function () { return 7 }; invoke $f')).resolves.toBe(7);
});

test('function handles retain unsafe confirmation after mutation', async () => {
  let called = false;
  const {run, vm} = setup({confirmUnsafe: async () => false});
  const privileged = vm.registerCommand('privileged', {
    type: FUNCTION_TYPE.Internal,
    unsafe: true,
    callback: async () => {
      called = true;
    },
  });
  vm.registerCommand('callback', {
    type: FUNCTION_TYPE.Internal,
    callback: async () => privileged,
  });
  await expect(run("$callback = (callback); $callback['unsafe'] = false; invoke $callback")).rejects.toThrow(
    'rejected',
  );
  expect(called).toBe(false);
});

test('rejects forged function descriptors', async () => {
  const {run, vm} = setup();
  const callback = vm.registerCommand('callback', {
    type: FUNCTION_TYPE.Internal,
    callback: async () => 7,
  });
  vm.registerCommand('function_value', {
    type: FUNCTION_TYPE.Internal,
    callback: async () => callback,
  });
  await expect(run("$fn = (function_value); invoke {callback: $fn['callback'], args: [], type: 2}")).rejects.toThrow(
    'Invalid value',
  );
});

test('preserves mutable and non-cloneable host command results', async () => {
  const record = {profile: {name: 'Ada'}};
  const callback = () => record;
  const {run, vm} = setup({processCommandJob: async ({cmdName}) => (cmdName === 'record' ? record : callback)});
  vm.registerCommand('record', {});
  vm.registerCommand('callback', {});
  vm.use(api => {
    api.registerCommand('plugin_callback', {callback: async () => callback});
  });
  await expect(run('record')).resolves.toBe(record);
  await expect(
    run("$record = (record); $record['profile']['name'] = 'Grace'; $record['profile']['name']"),
  ).resolves.toBe('Grace');
  expect(record.profile.name).toBe('Grace');
  await expect(run('callback')).resolves.toBe(callback);
  await expect(run('plugin_callback')).resolves.toBe(callback);
});

test('does not let script functions replace registered capabilities', async () => {
  let calls = 0;
  const {run, vm} = setup();
  vm.registerCommand('protected', {type: FUNCTION_TYPE.Internal, callback: async () => ++calls});
  await expect(run('function protected() { return 7 }')).rejects.toThrow(
    "Cannot replace registered command 'protected'",
  );
  await expect(run('protected')).resolves.toBe(1);
});

test('enforces source, nesting, collection and string limits', async () => {
  const {interpreter, vm} = setup({maxCollectionLength: 4, maxStringLength: 4});
  const options = {registeredCmds: vm.getRegisteredCmds()};
  expect(() => interpreter.parse('x'.repeat(11), {...options, maxSourceLength: 10})).toThrow(
    'Source exceeds maxSourceLength',
  );
  expect(() => interpreter.parse(`${'['.repeat(4)}0${']'.repeat(4)}`, {...options, maxNestingDepth: 3})).toThrow(
    'Source exceeds maxNestingDepth',
  );
  await expect(vm.execute(interpreter.parse("$items = []; $items['length'] = 5", options))).rejects.toThrow(
    'maxCollectionLength',
  );
  await expect(vm.execute(interpreter.parse("'abc' + 'de'", options))).rejects.toThrow('maxStringLength');
});

test('functions resolve lexical bindings and updates reach existing outer variables', async () => {
  const {run} = setup();
  await expect(run('$x = 1; function read() { return $x }; function call(x) { return (read) }; call 7')).resolves.toBe(
    1,
  );
  await expect(run('function update() { $x = 2 }; update; $x')).resolves.toBe(2);
  await expect(run('call 9')).resolves.toBe(2);
  await expect(
    run('$f = function () { return $hidden }; function caller(hidden) { return ($$f) }; caller 7', {
      throwSilentErrors: true,
    }),
  ).rejects.toThrow('hidden');
});

test('compound assignments preserve missing, undefined and invalid binding errors', async () => {
  const {run} = setup();
  await expect(run('$missing += 1')).rejects.toMatchObject({name: 'UnknownStoreValue'});
  await expect(run('$value = undefined; $value += 1')).rejects.toMatchObject({name: 'InvalidNameError'});
  await expect(run('$value = null; $value += 1')).rejects.toMatchObject({name: 'InvalidValueError'});
  await expect(run('$value')).resolves.toBeNull();
});

test('escaped closures share mutable bindings but factory calls have independent locals', async () => {
  const {run} = setup();
  await run(`
    function counter(n) { return (function () { $n++; return $n }) };
    $a = (counter 0); $b = (counter 10)
  `);
  await expect(run('[$$a, $$a, $$b, $$a]')).resolves.toEqual([1, 2, 11, 3]);
  await expect(
    run(`
    function pair(n) {
      return [function () { $n++; return $n }, function () { return $n }]
    };
    $pair = (pair 20); $inc = $pair[0]; $read = $pair[1];
    [($$inc), ($$read), ($$inc), ($$read)]
  `),
  ).resolves.toEqual([21, 21, 22, 22]);
});

test('closures survive block exit and capture the definition environment in callbacks and defaults', async () => {
  const {run} = setup();
  await expect(
    run(`
    $saved = null;
    if (true) { $block = 12; $saved = function () { return $block } };
    invoke $saved
  `),
  ).resolves.toBe(12);
  await expect(
    run(`
    $x = 3;
    function apply(fn, x) { return (invoke $fn) };
    apply (function (value = $x) { return $value }) 99
  `),
  ).resolves.toBe(3);
  await expect(
    run(`
    function readDefault(value = $x) { return $value };
    function callDefault(x) { return (readDefault) };
    callDefault 99
  `),
  ).resolves.toBe(3);
});

test('recursive closures retain lexical bindings and parameters shadow captured names', async () => {
  const {run} = setup();
  await expect(
    run(`
    $n = 100;
    $factorial = function (n) {
      if ($n <= 1) { return 1 };
      return $n * ($$factorial ($n - 1))
    };
    [($$factorial 5), $n]
  `),
  ).resolves.toEqual([120, 100]);
});

test('explicit arguments do not evaluate default expressions', async () => {
  let called = 0;
  const {run, vm} = setup();
  vm.registerCommand('next', {type: FUNCTION_TYPE.Internal, callback: async () => ++called});
  await expect(run('function pick(x = (next)) { return $x }; pick 7')).resolves.toBe(7);
  expect(called).toBe(0);
  await expect(run('pick')).resolves.toBe(1);
});

test('named flags and positional arguments keep their values', async () => {
  const {run, vm} = setup();
  vm.registerCommand('flagged', {
    type: FUNCTION_TYPE.Internal,
    args: [
      [ARG.String, ['v', 'value'], true, 'Value'],
      [ARG.Flag, ['a', 'all'], false, 'All'],
    ],
    callback: async (_, kwargs) => [kwargs.value, kwargs.all],
  });
  await expect(run("flagged 'hello' --all")).resolves.toEqual(['hello', true]);
});

test('comments preserve strings, multiline contents and source positions', async () => {
  const {run, interpreter} = setup();
  await expect(run("$s = 'first\n// inside string\nlast'; $s")).resolves.toBe('first\n// inside string\nlast');
  await expect(run('/* first\n second */\n1 + 2 // trailing')).resolves.toBe(3);
  await expect(run("['}', ']', ')', '/* text */', 'https://example.test']")).resolves.toEqual([
    '}',
    ']',
    ')',
    '/* text */',
    'https://example.test',
  ]);
  const source = '// header\n  $missing';
  expect(interpreter.tokenize(source, {}).at(-1).start).toBe(source.indexOf('$missing'));
});

test.each(["'unfinished", '[1, 2', '{a: 1', '(1 + 2', '/* unfinished'])('rejects unfinished input: %s', source => {
  expect(() => setup().parse(source)).toThrow();
});
