// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../translation';

export default class extends Error {
  vname: string;
  start: number;
  end: number;

  constructor(vname: string, start: number, end: number) {
    super(
      i18n.t('trash.exception.unknownNameError', "Unknown name '{{vname}}' at {{start}}:{{end}}", {vname, start, end}),
    );
    this.name = 'UnknownNameError';
    this.vname = vname;
    this.start = start;
    this.end = end;
  }
}
