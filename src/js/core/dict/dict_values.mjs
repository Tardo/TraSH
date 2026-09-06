// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcDictValues(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<Array<mixed>> {
  return Object.values(kwargs.dict);
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcDictValues.definition', 'Get the values of a dictionary'),
    callback: funcDictValues,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('funcDictValues.detail', 'Return an array with all the values of a dictionary'),
    args: [[ARG.Dictionary, ['d', 'dict'], true, i18n.t('funcDictValues.args.dict', 'The dictionary')]],
    example: '-d {a: 1, b: 2}',
  };
}
