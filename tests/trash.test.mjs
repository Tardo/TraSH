import {Frame, Interpreter, setTranslator, translate, VMachine} from '@tardo/trash';
import registerStr from '@tardo/trash/core/str/__all__';

test('matches Shell evaluation semantics', async () => {
  const interpreter = new Interpreter();
  const vmachine = new VMachine({
    processCommandJob: async () => null,
    silent: false,
  });
  registerStr(vmachine);
  const evaluate = (source, isolatedFrame = false, all = false) =>
    vmachine.execute(
      interpreter.parse(source, {registeredCmds: vmachine.getRegisteredCmds()}),
      {aliases: {}, isData: false, silent: false},
      isolatedFrame ? new Frame() : undefined,
      all,
    );

  await evaluate('$value = 4');
  await expect(evaluate('$value')).resolves.toBe(4);
  await evaluate('$value = 8', true);
  await expect(evaluate('$value')).resolves.toBe(4);
  await expect(evaluate('1; 2; 3', false, true)).resolves.toEqual([1, 2, 3]);
  await expect(evaluate("str_upper 'world'")).resolves.toBe('WORLD');
});

test('uses a configurable translation function', () => {
  expect(translate('greeting', 'Hello {{name}}', {name: 'Ada'})).toBe('Hello Ada');

  setTranslator((key, fallback, values) => `${key}:${values?.name ?? fallback}`);
  try {
    expect(translate('greeting', 'Hello {{name}}', {name: 'Ada'})).toBe('greeting:Ada');
    expect(VMachine.makeCommand({}).definition).toBe('terminal.cmd.default.definition:Undefined command');
  } finally {
    setTranslator();
  }
});

test('interpolates placeholders without backtracking on malformed input', () => {
  expect(translate('key', '{{ \tname\n }}: {{count}} {{missing}}', {name: 'Ada', count: 0})).toBe('Ada: 0 {{missing}}');
  expect(translate('key', '{{name}}')).toBe('{{name}}');
  for (const fallback of ['{{' + ' '.repeat(100_000) + '!', '{{'.repeat(100_000) + 'name']) {
    expect(translate('key', fallback, {name: 'Ada'})).toBe(fallback);
  }
});
