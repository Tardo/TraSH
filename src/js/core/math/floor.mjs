// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcFloor(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<number> {
  return Math.floor(kwargs.num);
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcFloor.definition', 'Rounds a number DOWN to the nearest integer'),
    callback: funcFloor,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('funcFloor.detail', 'Rounds a number DOWN to the nearest integer'),
    args: [[ARG.Number, ['n', 'num'], true, i18n.t('funcFloor.args.num', 'The number')]],
    example: '-n 12.3',
  };
}
