// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../translation';

export default class extends Error {
  value: mixed;

  constructor(value: mixed) {
    const valueText =
      value === null ? 'null' : typeof value === 'object' || typeof value === 'function' ? typeof value : String(value);
    super(
      i18n.t('trash.exception.invalidValueError', "Invalid value '{{value}}'", {
        value: valueText,
      }),
    );
    this.name = 'InvalidValueError';
    this.value = value;
  }
}
