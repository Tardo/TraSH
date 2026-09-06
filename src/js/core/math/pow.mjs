// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcPow(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<number> {
  return Math.pow(kwargs.base, kwargs.exponent);
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcPow.definition', 'Calculate the exponent value of x raised to the power of y'),
    callback: funcPow,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('funcPow.detail', 'Calculate the exponent value of x raised to the power of y'),
    args: [
      [ARG.Number, ['b', 'base'], true, i18n.t('funcPow.args.base', 'Base')],
      [ARG.Number, ['e', 'exponent'], true, i18n.t('funcPow.args.exponent', 'Exponent')],
    ],
    example: '-b 2 -e 5',
  };
}
