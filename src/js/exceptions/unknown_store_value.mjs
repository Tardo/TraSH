// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../translation';

export default class extends Error {
  vname: string;

  constructor(vname: string) {
    super(i18n.t('trash.exception.unknownStoreValue', "Unknown store value '{{vname}}'", {vname}));
    this.name = 'UnknownStoreValue';
    this.vname = vname;
  }
}
