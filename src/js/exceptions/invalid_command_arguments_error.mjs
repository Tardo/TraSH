// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../translation';

export default class extends Error {
  cmd_name: string;
  args: Array<string>;

  constructor(cmd_name: string, args: Array<string>) {
    super(i18n.t('trash.exception.invalidCommandArgumentsError', 'Invalid command arguments'));
    this.name = 'InvalidCommandArgumentsError';
    this.cmd_name = cmd_name;
    this.args = args;
  }
}
