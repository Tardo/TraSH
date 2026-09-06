// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../translation';

export default class extends Error {
  arg_name: string;
  start: number;
  end: number;

  constructor(arg_name: string, start: number, end: number) {
    super(
      i18n.t(
        'trash.exception.notExpectedCommandArgumentError',
        "Argument '{{arg_name}}' not expected at {{start}}:{{end}}",
        {arg_name, start, end},
      ),
    );
    this.name = 'NotExpectedCommandArgumentError';
    this.arg_name = arg_name;
    this.start = start;
    this.end = end;
  }
}
