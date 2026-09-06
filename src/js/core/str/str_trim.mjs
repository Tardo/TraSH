// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcStrTrim(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<string> {
  return String(kwargs.str).trim();
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcStrTrim.definition', 'Trim whitespace from both ends of a string'),
    callback: funcStrTrim,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('funcStrTrim.detail', 'Return the string with leading and trailing whitespace removed'),
    args: [[ARG.String, ['s', 'str'], true, i18n.t('funcStrTrim.args.str', 'The string')]],
    example: "-s '  hello  '",
  };
}
