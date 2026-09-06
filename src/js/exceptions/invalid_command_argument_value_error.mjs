// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../translation';

export default class extends Error {
  cmd_name: string;
  arg_value: mixed;

  constructor(cmd_name: string, arg_value: mixed) {
    super(i18n.t('trash.exception.invalidCommandArugmentValueError', "Unexpected '{{arg_value}}' value!", {arg_value}));
    this.name = 'InvalidCommandArgumentValueError';
    this.cmd_name = cmd_name;
    this.arg_value = arg_value;
  }
}
