// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../translation';

export default class extends Error {
  cmd_name: string;
  start: number;
  end: number;

  constructor(cmd_name: string, start: number, end: number) {
    super(
      i18n.t('trash.exception.unknownCommandError', "Unknown Command '{{cmd_name}}' at {{start}}:{{end}}", {
        cmd_name,
        start,
        end,
      }),
    );
    this.name = 'UnknownCommandError';
    this.cmd_name = cmd_name;
    this.start = start;
    this.end = end;
  }
}
