import {Frame, Interpreter, VMachine} from '@tardo/trash';
import {INSTRUCTION_SIZE, INSTRUCTION_TYPE} from '@tardo/trash/constants';
import {FUNCTION_TYPE} from '@tardo/trash/function';

const interpreter = new Interpreter();
const parse = source => interpreter.parse(source, {});
const machine = () => new VMachine({processCommandJob: async () => null});

test.each([
  ['$sum = 0; for ($i = 0; $i < 1000; $i++) { $sum += $i }; $sum', 499500],
  ['$x = 12; $x += 4; $x -= 2; $x *= 3; $x /= 2; $x++; --$x; $x', 21],
  ['$x = 3; [$x++, ++$x, $x--, --$x]', [3, 5, 5, 3]],
  [
    '$x = 5; [$x + 2, $x - 2, $x * 2, $x / 2, $x % 2, $x > 2, $x < 2, $x >= 5, $x <= 5]',
    [7, 3, 10, 2.5, 1, true, false, true, true],
  ],
  ['$x = 1; $x += 2; $x += "a"; $x++; $x', '3a1'],
  ['$x = 1; $x /= 0; $x -= $x; $x', NaN],
  ['$x = 0; if (true) { $x += 1 && 0 } else { $x += 9 }; $x', 0],
  ['$x = 0; if (true) { $x += 2 } else { $x += 9 }; $x', 2],
  ['$x = 0; for ($i = 0; $i < 3; $i++) { $local = 10; $local++; $x += $local }; $x', 33],
  ['$x = 0; for ($i = 0; $i < 3; $i++) { $x += 1; 99 }; $x', 3],
  ['$x = 0; for ($i = 0; $i <= 100; $i++) { $x += 3; $x -= 1; $x *= 2; $x /= 2 }; $x', 202],
  ['$x = 0; for ($i = 100; $i >= 1; $i--) { $x += $i % 7 }; $x', 297],
  ['$x = 0; for ($i = 100; $i > 0; $i--) { $x += $i * 2 / 2 - 1 }; $x', 4950],
])('numeric execution agrees with the general dispatcher: %s', async (source, expected) => {
  const program = parse(source);
  await expect(machine().execute(program)).resolves.toEqual(expected);
  // An externally supplied frame uses the general dispatcher.
  await expect(machine().execute(program, {}, new Frame())).resolves.toEqual(expected);
});

test('every instruction limit preserves the same partial writes as the general dispatcher', async () => {
  const program = parse('$sum = 0; for ($i = 0; $i < 4; $i++) { $sum += $i }; $sum');
  const read = parse('$sum');
  const outcome = promise =>
    promise.then(
      value => ({value}),
      error => ({error: error.name}),
    );
  for (let maxInstructions = 1; maxInstructions <= 50; maxInstructions++) {
    const fast = machine();
    const slow = machine();
    const frame = new Frame();
    expect(await outcome(fast.execute(program, {maxInstructions}))).toEqual(
      await outcome(slow.execute(program, {maxInstructions}, frame)),
    );
    expect(await outcome(fast.execute(read))).toEqual(await outcome(slow.execute(read, {}, frame)));
  }
});

test('cached writes are visible to commands and command mutations are observed on resumption', async () => {
  const vm = new VMachine({processCommandJob: async () => vm.execute(parse('$sum += 100; $sum'))});
  vm.registerCommand('observe', {});
  const program = interpreter.parse(
    '$sum = 0; for ($i = 0; $i < 5; $i++) { $sum += $i }; $observed = (observe); $sum++; [$observed, $sum]',
    {registeredCmds: vm.getRegisteredCmds()},
  );
  await expect(vm.execute(program)).resolves.toEqual([110, 111]);
});

test('accessor bindings fall back without duplicate reads or writes', async () => {
  const vm = machine();
  let reads = 0;
  vm.registerCommand('install', {
    type: FUNCTION_TYPE.Internal,
    callback: async (_, kwargs, frame) => {
      Object.defineProperty(frame.prevFrame.locals, 'value', {get: () => ++reads, configurable: true});
    },
  });
  const program = interpreter.parse('install; $sum = 0; for ($i = 0; $i < 6; $i++) { $sum += $value }; $sum', {
    registeredCmds: vm.getRegisteredCmds(),
  });
  await expect(vm.execute(program)).resolves.toBe(21);
  expect(reads).toBe(6);
});

test('numeric loops in closures share bindings and the instruction budget', async () => {
  const vm = machine();
  await vm.execute(
    parse(`
    function counter(n) {
      return (function () { for ($i = 0; $i < 100; $i++) { $n++ }; return $n })
    };
    $next = (counter 1)
  `),
  );
  await expect(vm.execute(parse('$$next'))).resolves.toBe(101);
  await expect(vm.execute(parse('$$next'))).resolves.toBe(201);
  await expect(vm.execute(parse('$$next'), {maxInstructions: 100})).rejects.toThrow('Instruction limit exceeded');
});

test('numeric slices yield for cancellation and flush partial writes', async () => {
  const vm = machine();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 0);
  try {
    await expect(
      vm.execute(parse('$sum = 0; for ($i = 0; $i < 100000; $i++) { $sum += 1 }; $sum'), {
        signal: controller.signal,
      }),
    ).rejects.toThrow('Execution aborted');
    const sum = await vm.execute(parse('$sum'));
    expect(sum).toBeGreaterThan(0);
    expect(sum).toBeLessThan(100000);
  } finally {
    clearTimeout(timer);
  }
});

test('legacy STORE_NAME compound assignments still execute', async () => {
  const program = parse('$n = 1; $n += 2; $n');
  const {instructions} = program.program;
  for (let offset = 0; offset < instructions.length; offset += INSTRUCTION_SIZE) {
    if (instructions[offset] === INSTRUCTION_TYPE.STORE_ADD) instructions[offset] = INSTRUCTION_TYPE.STORE_NAME;
  }
  await expect(machine().execute(program)).resolves.toBe(3);
});
