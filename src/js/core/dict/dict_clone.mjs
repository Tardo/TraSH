// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcDictClone(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<{[string]: mixed}> {
  return {...kwargs.dict};
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcDictClone.definition', 'Clone a dictionary'),
    callback: funcDictClone,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('funcDictClone.detail', 'Return a shallow copy of a dictionary'),
    args: [[ARG.Dictionary, ['d', 'dict'], true, i18n.t('funcDictClone.args.dict', 'The dictionary')]],
    example: '-d {a: 1, b: 2}',
  };
}
