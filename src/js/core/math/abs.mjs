// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcAbs(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<number> {
  return Math.abs(kwargs.num);
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcAbs.definition', 'Absolute value of a number'),
    callback: funcAbs,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('funcAbs.detail', 'Returns the absolute value of a number.'),
    args: [[ARG.Number, ['n', 'num'], true, i18n.t('funcAbs.args.num', 'The number')]],
    example: '-n 12.3',
  };
}
