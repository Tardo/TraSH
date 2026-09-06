// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcArrPrepend(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<$ReadOnlyArray<mixed>> {
  kwargs.arr.unshift(kwargs.item);
  return kwargs.arr;
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcArrPrepend.definition', 'Prepend an item to an array'),
    callback: funcArrPrepend,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('funcArrPrepend.detail', 'Insert an item at the beginning of an array (mutates it in place)'),
    args: [
      [ARG.List | ARG.Any, ['a', 'arr'], true, i18n.t('funcArrPrepend.args.arr', 'The array')],
      [ARG.Any, ['i', 'item'], true, i18n.t('funcArrPrepend.args.item', 'The item to prepend')],
    ],
    example: "-a $arr -i 'value'",
  };
}
