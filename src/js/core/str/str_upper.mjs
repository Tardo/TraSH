// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcStrUpper(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<string> {
  return String(kwargs.str).toUpperCase();
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcStrUpper.definition', 'Convert string to uppercase'),
    callback: funcStrUpper,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('funcStrUpper.detail', 'Return the string converted to uppercase'),
    args: [[ARG.String, ['s', 'str'], true, i18n.t('funcStrUpper.args.str', 'The string')]],
    example: "-s 'hello'",
  };
}
