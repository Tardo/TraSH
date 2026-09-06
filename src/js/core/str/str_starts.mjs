// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcStrStarts(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<boolean> {
  return String(kwargs.str).startsWith(kwargs.prefix);
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcStrStarts.definition', 'Check if a string starts with a prefix'),
    callback: funcStrStarts,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('funcStrStarts.detail', 'Return true if the string starts with the given prefix'),
    args: [
      [ARG.String, ['s', 'str'], true, i18n.t('funcStrStarts.args.str', 'The string')],
      [ARG.String, ['p', 'prefix'], true, i18n.t('funcStrStarts.args.prefix', 'The prefix to check')],
    ],
    example: "-s 'hello world' -p 'hello'",
  };
}
