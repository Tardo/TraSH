// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcDictRemove(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<{[string]: mixed}> {
  delete kwargs.dict[kwargs.key];
  return kwargs.dict;
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcDictRemove.definition', 'Remove a key from a dictionary'),
    callback: funcDictRemove,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('funcDictRemove.detail', 'Remove the given key from a dictionary (mutates the dictionary in place)'),
    args: [
      [ARG.Dictionary, ['d', 'dict'], true, i18n.t('funcDictRemove.args.dict', 'The dictionary')],
      [ARG.String | ARG.Number, ['k', 'key'], true, i18n.t('funcDictRemove.args.key', 'The key')],
    ],
    example: "-d $dict -k 'a'",
  };
}
