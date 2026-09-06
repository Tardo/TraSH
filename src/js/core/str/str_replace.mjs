// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcStrReplace(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<string> {
  const s = String(kwargs.str);
  if (kwargs.all) {
    return s.replaceAll(kwargs.search, kwargs.replacement);
  }
  return s.replace(kwargs.search, kwargs.replacement);
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcStrReplace.definition', 'Replace occurrences in a string'),
    callback: funcStrReplace,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('funcStrReplace.detail', 'Replace the first (or all with -a) occurrences of a substring'),
    args: [
      [ARG.String, ['s', 'str'], true, i18n.t('funcStrReplace.args.str', 'The source string')],
      [ARG.String, ['f', 'search'], true, i18n.t('funcStrReplace.args.search', 'The substring to find')],
      [ARG.String, ['r', 'replacement'], true, i18n.t('funcStrReplace.args.replacement', 'The replacement string')],
      [ARG.Flag, ['a', 'all'], false, i18n.t('funcStrReplace.args.all', 'Replace all occurrences')],
    ],
    example: "-s 'hello world' -f 'o' -r '0' -a",
  };
}
