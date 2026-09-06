// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from '../translation';

export default class extends Error {
  constructor() {
    super(i18n.t('trash.exception.invalidCommandDefinition', 'Invalid command definition!'));
    this.name = 'invalidCommandDefinitionError';
  }
}
