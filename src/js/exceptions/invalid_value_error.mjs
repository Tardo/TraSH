// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../translation';

export default class extends Error {
  value: mixed;

  constructor(value: mixed) {
    super(
      i18n.t('trash.exception.invalidValueError', "Invalid value '{{value}}'", {
        value: new String(value).toString(),
      }),
    );
    this.name = 'InvalidValueError';
    this.value = value;
  }
}
