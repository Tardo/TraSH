// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcStrSplit(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<$ReadOnlyArray<string>> {
  return String(kwargs.str).split(kwargs.delim);
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcStrSplit.definition', 'Split a string into an array'),
    callback: funcStrSplit,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('funcStrSplit.detail', 'Split a string by a delimiter and return an array of substrings'),
    args: [
      [ARG.String, ['s', 'str'], true, i18n.t('funcStrSplit.args.str', 'The string to split')],
      [ARG.String, ['d', 'delim'], false, i18n.t('funcStrSplit.args.delim', 'The delimiter'), ''],
    ],
    example: "-s 'hello world' -d ' '",
  };
}
