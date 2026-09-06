// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcRand(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<number> {
  return parseInt(Math.floor(Math.random() * (kwargs.max - kwargs.min + 1) + kwargs.min), 10);
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcRand.definition', 'Generate random integers'),
    callback: funcRand,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('funcRand.detail', 'Return random integers'),
    args: [
      [ARG.Number, ['mi', 'min'], true, i18n.t('funcRand.args.min', 'Min. value')],
      [ARG.Number, ['ma', 'max'], true, i18n.t('funcRand.args.max', 'Max. value')],
    ],
    example: '-n 12.3',
  };
}
