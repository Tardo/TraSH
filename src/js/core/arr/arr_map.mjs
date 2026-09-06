// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type {default as VMachine, EvalOptions} from '../../vmachine';
import type Frame from '../../frame';

async function funcArrMap(
  vmachine: VMachine,
  kwargs: CMDCallbackArgs,
  frame: Frame,
  opts: EvalOptions,
): Promise<Array<mixed>> {
  const res = [];
  for (const item of kwargs.arr) {
    res.push(await vmachine.callFunctionValue(kwargs.mapper, [item], frame, opts));
  }
  return res;
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcArrMap.definition', 'Map an array'),
    callback: funcArrMap,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('funcArrMap.detail', 'Return a new array with the mapper function applied to each element'),
    args: [
      [ARG.List | ARG.Any, ['a', 'arr'], true, i18n.t('funcArrMap.args.arr', 'The array')],
      [ARG.Any, ['m', 'mapper'], true, i18n.t('funcArrMap.args.mapper', 'The mapper function')],
    ],
    example: '-a $arr -m (function (item) { return $item * 2 })',
  };
}
