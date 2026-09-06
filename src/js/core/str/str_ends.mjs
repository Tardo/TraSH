// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcStrEnds(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<boolean> {
  return String(kwargs.str).endsWith(kwargs.suffix);
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcStrEnds.definition', 'Check if a string ends with a suffix'),
    callback: funcStrEnds,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('funcStrEnds.detail', 'Return true if the string ends with the given suffix'),
    args: [
      [ARG.String, ['s', 'str'], true, i18n.t('funcStrEnds.args.str', 'The string')],
      [ARG.String, ['u', 'suffix'], true, i18n.t('funcStrEnds.args.suffix', 'The suffix to check')],
    ],
    example: "-s 'hello world' -u 'world'",
  };
}
