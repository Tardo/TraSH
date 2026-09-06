// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcDictHas(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<boolean> {
  return Object.hasOwn(kwargs.dict, kwargs.key);
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcDictHas.definition', 'Check if a dictionary has a key'),
    callback: funcDictHas,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('funcDictHas.detail', 'Return true if the dictionary has the given key'),
    args: [
      [ARG.Dictionary, ['d', 'dict'], true, i18n.t('funcDictHas.args.dict', 'The dictionary')],
      [ARG.String | ARG.Number, ['k', 'key'], true, i18n.t('funcDictHas.args.key', 'The key')],
    ],
    example: "-d {a: 1} -k 'a'",
  };
}
