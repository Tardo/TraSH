// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcStrSlice(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<string> {
  const s = String(kwargs.str);
  if (typeof kwargs.end !== 'undefined') {
    return s.slice(kwargs.begin, kwargs.end);
  }
  return s.slice(kwargs.begin);
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcStrSlice.definition', 'Extract a substring'),
    callback: funcStrSlice,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t(
      'funcStrSlice.detail',
      'Return the portion of the string from begin to end (exclusive). Negative indices count from the end.',
    ),
    args: [
      [ARG.String, ['s', 'str'], true, i18n.t('funcStrSlice.args.str', 'The string')],
      [
        ARG.Number,
        ['b', 'begin'],
        true,
        i18n.t('funcStrSlice.args.begin', 'Start index (inclusive, negative counts from end)'),
      ],
      [
        ARG.Number,
        ['e', 'end'],
        false,
        i18n.t('funcStrSlice.args.end', 'End index (exclusive, negative counts from end)'),
      ],
    ],
    example: "-s 'hello world' -b 6",
  };
}
