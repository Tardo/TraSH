// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcSleep(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<> {
  await new Promise(resolve => setTimeout(resolve, kwargs.time));
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('cmdSleep.definition', 'Sleep'),
    callback: funcSleep,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t('cmdSleep.detail', 'Sleep (time in ms)'),
    args: [[ARG.Number, ['t', 'time'], false, i18n.t('cmdSleep.args.time', 'The time to sleep (in ms)')]],
    example: '-t 200',
  };
}
