// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcStrIncludes(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<boolean> {
  return String(kwargs.str).includes(kwargs.needle);
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcStrIncludes.definition', 'Check if a string contains a substring'),
    callback: funcStrIncludes,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('funcStrIncludes.detail', 'Return true if the string contains the given substring'),
    args: [
      [ARG.String, ['s', 'str'], true, i18n.t('funcStrIncludes.args.str', 'The string')],
      [ARG.String, ['n', 'needle'], true, i18n.t('funcStrIncludes.args.needle', 'The substring to search for')],
    ],
    example: "-s 'hello world' -n 'world'",
  };
}
