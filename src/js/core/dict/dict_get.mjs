// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';
import {propertyKey} from '../../utils/property';

async function funcDictGet(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<mixed> {
  propertyKey(kwargs.key);
  if (Object.hasOwn(kwargs.dict, kwargs.key)) {
    return kwargs.dict[kwargs.key];
  }
  return kwargs.default;
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcDictGet.definition', 'Get a value from a dictionary'),
    callback: funcDictGet,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t(
      'funcDictGet.detail',
      'Return the value for the given key, or the default value if the key does not exist',
    ),
    args: [
      [ARG.Dictionary, ['d', 'dict'], true, i18n.t('funcDictGet.args.dict', 'The dictionary')],
      [ARG.String | ARG.Number, ['k', 'key'], true, i18n.t('funcDictGet.args.key', 'The key')],
      [ARG.Any, ['de', 'default'], false, i18n.t('funcDictGet.args.default', 'The default value')],
    ],
    example: "-d {a: 1} -k 'b' -de 0",
  };
}
