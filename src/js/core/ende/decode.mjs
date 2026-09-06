// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcDecode(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<string> {
  if (kwargs.method === 'b64') {
    return atob(kwargs.value);
  }
  return kwargs.value;
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcDecode.definition', 'Decode data'),
    callback: funcDecode,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('funcDecode.detail', 'Decode data'),
    args: [
      [ARG.String, ['v', 'value'], true, i18n.t('funcDecode.args.value', 'The value to decode')],
      [ARG.String, ['m', 'method'], true, i18n.t('funcDecode.args.method', 'The method to decode'), 'b64', ['b64']],
    ],
    example: '-v VGhpcyBpcyBhbiBleGFtcGxl -m b64',
  };
}
