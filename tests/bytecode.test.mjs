import {serialize, deserialize} from 'node:v8';
import {Interpreter, VMachine} from '@tardo/trash';
import {INSTRUCTION_SIZE, INSTRUCTION_TYPE} from '@tardo/trash/constants';

test('emits fixed-width binary instructions with a constant pool and source locations', async () => {
  const parsed = new Interpreter().parse('42 + 7', {});
  const {instructions, constants, sourceMap} = parsed.program;
  expect(instructions).toBeInstanceOf(Uint8Array);
  expect(instructions.byteLength).toBe(4 * INSTRUCTION_SIZE);
  expect(sourceMap).toBeInstanceOf(Int32Array);
  expect(sourceMap.length).toBe(8);
  const view = new DataView(instructions.buffer);
  expect(instructions[0]).toBe(INSTRUCTION_TYPE.LOAD_CONST);
  expect(constants[view.getInt32(1, true)]).toBe(42);
  expect(instructions[INSTRUCTION_SIZE]).toBe(INSTRUCTION_TYPE.LOAD_CONST);
  expect(constants[view.getInt32(INSTRUCTION_SIZE + 1, true)]).toBe(7);
  expect(instructions[2 * INSTRUCTION_SIZE]).toBe(INSTRUCTION_TYPE.ADD);
  expect(instructions[3 * INSTRUCTION_SIZE]).toBe(INSTRUCTION_TYPE.RETURN_VALUE);
  expect(view.getInt32(3 * INSTRUCTION_SIZE + 1, true)).toBe(-1);
  expect(parsed.inputTokens[sourceMap[0]][sourceMap[1]].value).toBe('42');
  await expect(new VMachine({processCommandJob: async () => null}).execute(parsed)).resolves.toBe(49);
});

test('serialized programs preserve nested function bytecode, defaults and special constants', async () => {
  const parsed = new Interpreter().parse(
    `
    $x = 4;
    function compute(n = $x) { return $n + 1 };
    $fn = function (n) { return $n + 1 };
    [($$fn 2), (compute), undefined, null, -0]
  `,
    {},
  );
  const restored = deserialize(serialize(parsed));
  // A bytecode view need not start at byte zero of its backing buffer.
  const bytes = restored.program.instructions;
  const buffer = new Uint8Array(bytes.length + 7);
  buffer.set(bytes, 7);
  restored.program.instructions = buffer.subarray(7);
  const vm = new VMachine({processCommandJob: async () => null});
  await expect(new VMachine({processCommandJob: async () => null}).execute(restored)).resolves.toEqual([
    3,
    5,
    undefined,
    null,
    -0,
  ]);
  await expect(vm.execute(restored)).resolves.toEqual([3, 5, undefined, null, -0]);
});

test('pool indexes and forward jumps are not truncated to 16 bits', async () => {
  const parsed = new Interpreter().parse(`if (false) { ${'0;'.repeat(65_536)} }; 42`, {});
  expect(parsed.program.constants.length).toBeGreaterThan(65_535);
  await expect(new VMachine({processCommandJob: async () => null}).execute(parsed)).resolves.toBe(42);
});

test('source mapping retains error offsets inside nested units', async () => {
  const source = '$x = [1, ($missing + 2)]';
  const parsed = new Interpreter().parse(source, {});
  await expect(new VMachine({processCommandJob: async () => null}).execute(parsed)).rejects.toMatchObject({
    name: 'UnknownNameError',
    start: source.indexOf('$missing'),
    end: source.indexOf('$missing') + '$missing'.length,
  });
});
