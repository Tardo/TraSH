// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcStrLower(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<string> {
  return String(kwargs.str).toLowerCase();
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcStrLower.definition', 'Convert string to lowercase'),
    callback: funcStrLower,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('funcStrLower.detail', 'Return the string converted to lowercase'),
    args: [[ARG.String, ['s', 'str'], true, i18n.t('funcStrLower.args.str', 'The string')]],
    example: "-s 'HELLO'",
  };
}
