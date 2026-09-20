import {ARG, FUNCTION_TYPE, Frame, Interpreter, VMachine} from '@tardo/trash';

const PARTNERS = [
  {id: 1, name: 'Ada', is_company: true},
  {id: 2, name: 'Bea', is_company: false},
  {id: 3, name: 'Cy', is_company: true},
  {id: 4, name: 'Dee', is_company: false},
];

const noOptions = () => Promise.resolve([]);
const modelOptions = () => Promise.resolve(['res.partner']);

function rangeStart(min, max) {
  return max === undefined ? min : Math.min(min, max);
}

function generatedString(min, max) {
  return 'x'.repeat(Math.max(0, Math.floor(rangeStart(min, max))));
}

function generatedValue(type, min, max) {
  const start = rangeStart(min, max);
  const end = max === undefined ? min : max;

  switch (type.toLowerCase()) {
    case 'int':
      return Math.ceil(start);
    case 'intseq':
      return Array.from(
        {length: Math.max(0, Math.floor(end) - Math.ceil(start) + 1)},
        (_, index) => Math.ceil(start) + index,
      );
    case 'float':
      return start;
    case 'str':
      return generatedString(min, max);
    case 'email':
      return `${generatedString(min, max) || 'x'}@example.test`;
    case 'url':
      return `https://example.test/${generatedString(min, max) || 'x'}`;
    case 'date':
    case 'tzdate':
      return new Date(start * 1000).toISOString().slice(0, 10);
    case 'time':
    case 'tztime':
      return new Date(start * 1000).toISOString().slice(11, 19);
    case 'datetime':
    case 'tzdatetime':
      return new Date(start * 1000).toISOString().replace('.000Z', '');
    default:
      return false;
  }
}

function resPartnerRecordset(offset, limit) {
  const start = offset ?? 0;
  const end = limit === undefined ? undefined : start + limit;
  const records = PARTNERS.slice(start, end).map(record => ({...record}));
  records.ids = records.map(record => record.id);
  return records;
}

function registerFixtures(vm) {
  vm.registerCommand('print', {
    definition: 'Print a message',
    callback: async (_, kwargs) => kwargs.msg,
    options: noOptions,
    detail: 'Eval parameters and print the result.',
    args: [[ARG.Any, ['m', 'msg'], true, 'The message to print']],
    secured: false,
    unsafe: false,
    aliases: ['echo'],
    example: "-m 'This is a example'",
    type: FUNCTION_TYPE.Internal,
    category: 'core',
  });

  vm.registerCommand('gen', {
    definition: 'Generate random values',
    callback: async (_, kwargs) => generatedValue(kwargs.type, kwargs.min, kwargs.max),
    options: noOptions,
    detail: "Generate numbers, strings, url's, dates, etc...",
    args: [
      [
        ARG.String,
        ['t', 'type'],
        true,
        'Generator type',
        'str',
        ['str', 'float', 'int', 'intseq', 'date', 'tzdate', 'time', 'tztime', 'datetime', 'tzdatetime', 'email', 'url'],
      ],
      [ARG.Number, ['mi', 'min'], false, 'Min. value', 1],
      [ARG.Number, ['ma', 'max'], false, 'Max. value'],
    ],
    secured: false,
    unsafe: false,
    aliases: [],
    example: '-t str -mi 2 -ma 4',
    type: FUNCTION_TYPE.Internal,
    category: 'devtools',
  });

  vm.registerCommand('search', {
    definition: 'Search model record/s',
    callback: async (_, kwargs) => {
      if (kwargs.model !== 'res.partner') {
        throw new Error(`Unsupported fixture model: ${kwargs.model}`);
      }
      return resPartnerRecordset(kwargs.offset, kwargs.limit);
    },
    options: modelOptions,
    detail: 'Launch orm search query',
    args: [
      [ARG.String, ['m', 'model'], true, 'The model technical name'],
      [
        ARG.List | ARG.String,
        ['f', 'field'],
        false,
        "The field names to request<br/>Can use '*' to show all fields of the model",
        ['display_name'],
      ],
      [ARG.List | ARG.Any, ['d', 'domain'], false, 'The domain', []],
      [ARG.Number, ['l', 'limit'], false, 'The limit of records to request'],
      [ARG.Number, ['of', 'offset'], false, 'The offset (from)<br/>Can be zero (no limit)'],
      [
        ARG.String,
        ['o', 'order'],
        false,
        'The sort order. MUST be quoted because it contains spaces: -o "name ASC" or -o "id DESC, name"',
      ],
      [ARG.Flag, ['more', 'more'], false, 'Flag to indicate that show more results'],
      [ARG.Flag, ['all', 'all'], false, 'Show all records (not truncated)'],
      [ARG.Flag, ['rb', 'read-binary'], false, "Don't filter binary fields"],
      [ARG.Dictionary, ['op', 'options'], false, 'The options'],
    ],
    secured: false,
    unsafe: false,
    aliases: [],
    example: '-m res.partner -f ["name", "email"] -l 100 -of 5 -o "id DESC, name"',
    type: FUNCTION_TYPE.Internal,
    category: 'core',
  });
}

export function makeTrash() {
  const interpreter = new Interpreter();
  const vmachine = new VMachine({
    processCommandJob: async () => null,
    silent: false,
  });
  registerFixtures(vmachine);

  const execute = (source, options = {}, isolatedFrame = false, all = false) =>
    vmachine.execute(
      interpreter.parse(source, {isData: options.isData, registeredCmds: vmachine.getRegisteredCmds()}),
      {aliases: {}, isData: false, silent: false, ...options},
      isolatedFrame ? new Frame() : undefined,
      all,
    );

  return {
    eval: (source, options, isolatedFrame) => execute(source, options, isolatedFrame),
    evalAll: (source, options, isolatedFrame) => execute(source, options, isolatedFrame, true),
  };
}
