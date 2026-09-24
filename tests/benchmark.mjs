import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {Interpreter, VMachine} from '@tardo/trash';

const interpreter = new Interpreter();
const vm = new VMachine({processCommandJob: async () => null});
const source = '$sum = 0; for ($i = 0; $i < 1000; $i++) { $sum += $i }; $sum';
const options = {registeredCmds: vm.getRegisteredCmds()};
const program = interpreter.parse(source, options);
async function benchmark() {
  assert.equal(await vm.execute(program), 499500);
  for (const [name, run, count] of [
    [
      'parse (1000 programs)',
      () => {
        for (let i = 0; i < 1000; i++) interpreter.parse(source, options);
      },
      1000,
    ],
    [
      'execute (100 programs, 1000 iterations each)',
      async () => {
        for (let i = 0; i < 100; i++) assert.equal(await vm.execute(program), 499500);
      },
      100,
    ],
  ]) {
    for (let i = 0; i < 5; i++) await run();
    const samples = [];
    for (let i = 0; i < 15; i++) {
      const start = performance.now();
      await run();
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    console.info(`${name}: ${samples[7].toFixed(2)} ms; ${(samples[7] / count).toFixed(4)} ms/program (median of 15)`);
  }
}

benchmark();
