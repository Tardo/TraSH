// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcDictSize(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<number> {
  return Object.keys(kwargs.dict).length;
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcDictSize.definition', 'Get the number of keys in a dictionary'),
    callback: funcDictSize,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('funcDictSize.detail', 'Return the number of keys of a dictionary'),
    args: [[ARG.Dictionary, ['d', 'dict'], true, i18n.t('funcDictSize.args.dict', 'The dictionary')]],
    example: '-d {a: 1, b: 2}',
  };
}
