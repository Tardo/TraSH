// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcArrClone(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<$ReadOnlyArray<mixed>> {
  return [...kwargs.arr];
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcArrClone.definition', 'Clone an array'),
    callback: funcArrClone,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('funcArrClone.detail', 'Return a shallow copy of an array'),
    args: [[ARG.List | ARG.Any, ['a', 'arr'], true, i18n.t('funcArrClone.args.arr', 'The array')]],
    example: '-a [1, 2, 3]',
  };
}
