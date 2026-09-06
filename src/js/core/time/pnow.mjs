// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {FUNCTION_TYPE} from '../../function';
import type {CMDDef} from '../../interpreter';

async function funcPNow(): Promise<number> {
  return performance.now();
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcPNow.definition', 'High resolution timestamp in milliseconds'),
    callback: funcPNow,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('funcPNow.detail', 'High resolution timestamp in milliseconds.'),
  };
}
