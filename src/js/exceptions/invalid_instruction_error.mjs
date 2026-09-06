// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../translation';

export default class extends Error {
  constructor(message?: string) {
    super(
      typeof message === 'undefined'
        ? i18n.t('trash.exception.invalidInstructionError', 'Invalid instruction')
        : message,
    );
    this.name = 'InvalidInstructionError';
  }
}
