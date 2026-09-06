// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcDictKeys(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<Array<string>> {
  return Object.keys(kwargs.dict);
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcDictKeys.definition', 'Get the keys of a dictionary'),
    callback: funcDictKeys,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('funcDictKeys.detail', 'Return an array with all the keys of a dictionary'),
    args: [[ARG.Dictionary, ['d', 'dict'], true, i18n.t('funcDictKeys.args.dict', 'The dictionary')]],
    example: '-d {a: 1, b: 2}',
  };
}
