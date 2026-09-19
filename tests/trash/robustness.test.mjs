import {ARG, FUNCTION_TYPE, Interpreter, VMachine, registerArr, registerDict} from '@tardo/trash';

function setup(options = {}) {
  const interpreter = new Interpreter();
  const vm = new VMachine({processCommandJob: async () => null, ...options});
  registerArr(vm);
  registerDict(vm);
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
      `dict_set {} '${key}' 1`,
      `dict_get {} '${key}'`,
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
  'arr_map [1, 2] (function (x) { for ($i = 0; true; $i++) { $i + 1 } })',
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

test('required arguments are checked even when none are supplied', async () => {
  await expect(setup().run('dict_get')).rejects.toThrow();
});

test('higher-order callbacks validate argument types and apply defaults', async () => {
  const {run} = setup();
  await expect(run("arr_map ['wrong'] (function (x: Number) { return $x })")).rejects.toThrow();
  await expect(run('arr_map [1, 2] (function (x, y = 10) { return $x + $y })')).resolves.toEqual([11, 12]);
  await expect(run('$f = function () { return 7 }; arr_map [1, 2] $f')).resolves.toEqual([7, 7]);
});

test('higher-order calls retain unsafe confirmation', async () => {
  let called = false;
  const {run, vm} = setup({confirmUnsafe: async () => false});
  vm.registerCommand('callback', {
    type: FUNCTION_TYPE.Internal,
    callback: async () =>
      VMachine.makeCommand({
        type: FUNCTION_TYPE.Internal,
        unsafe: true,
        callback: async () => {
          called = true;
        },
      }),
  });
  await expect(run('arr_map [1] (callback)')).rejects.toThrow('rejected');
  expect(called).toBe(false);
});

test('functions resolve the calling frame and updates reach existing outer variables', async () => {
  const {run} = setup();
  await expect(run('$x = 1; function read() { return $x }; function call(x) { return (read) }; call 7')).resolves.toBe(
    7,
  );
  await expect(run('function update() { $x = 2 }; update; $x')).resolves.toBe(2);
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
