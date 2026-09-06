// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcArrAppend(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<$ReadOnlyArray<mixed>> {
  kwargs.arr.push(kwargs.item);
  return kwargs.arr;
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcArrAppend.definition', 'Append an item to an array'),
    callback: funcArrAppend,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('funcArrAppend.detail', 'Append an item to the end of an array (mutates it in place)'),
    args: [
      [ARG.List | ARG.Any, ['a', 'arr'], true, i18n.t('funcArrAppend.args.arr', 'The array')],
      [ARG.Any, ['i', 'item'], true, i18n.t('funcArrAppend.args.item', 'The item to append')],
    ],
    example: "-a $arr -i 'value'",
  };
}
