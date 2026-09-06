// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type {default as VMachine, EvalOptions} from '../../vmachine';
import type Frame from '../../frame';

async function funcArrFilter(
  vmachine: VMachine,
  kwargs: CMDCallbackArgs,
  frame: Frame,
  opts: EvalOptions,
): Promise<Array<mixed>> {
  const res = [];
  for (const item of kwargs.arr) {
    if (await vmachine.callFunctionValue(kwargs.filter, [item], frame, opts)) {
      res.push(item);
    }
  }
  return res;
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcArrFilter.definition', 'Filter an array'),
    callback: funcArrFilter,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t(
      'funcArrFilter.detail',
      'Return a new array containing only the elements for which the filter function returns true',
    ),
    args: [
      [ARG.List | ARG.Any, ['a', 'arr'], true, i18n.t('funcArrFilter.args.arr', 'The array')],
      [ARG.Any, ['f', 'filter'], true, i18n.t('funcArrFilter.args.filter', 'The filter function')],
    ],
    example: '-a $arr -f (function (item) { return $item > 0 })',
  };
}
