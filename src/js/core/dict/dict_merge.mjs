// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../../translation';
import {ARG} from '../../constants';
import {FUNCTION_TYPE} from '../../function';
import type {CMDCallbackArgs, CMDDef} from '../../interpreter';
import type VMachine from '../../vmachine';

async function funcDictMerge(vmachine: VMachine, kwargs: CMDCallbackArgs): Promise<{[string]: mixed}> {
  return {...kwargs.dict, ...kwargs.other};
}

export default function (): Partial<CMDDef> {
  return {
    definition: i18n.t('funcDictMerge.definition', 'Merge two dictionaries'),
    callback: funcDictMerge,
    type: FUNCTION_TYPE.Internal,
    category: 'stdlib',
    detail: i18n.t(
      'funcDictMerge.detail',
      'Return a new dictionary with the entries of both dictionaries (the second one takes precedence)',
    ),
    args: [
      [ARG.Dictionary, ['d', 'dict'], true, i18n.t('funcDictMerge.args.dict', 'The dictionary')],
      [ARG.Dictionary, ['o', 'other'], true, i18n.t('funcDictMerge.args.other', 'The dictionary to merge in')],
    ],
    example: '-d {a: 1} -o {b: 2}',
  };
}
