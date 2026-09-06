// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

export default class extends Error {
  cmd_name: string;

  constructor(message: string, cmd_name: string) {
    super(`${cmd_name}. ${message}`);
    this.name = 'InvalidCommandArgumentFormatError';
    this.cmd_name = cmd_name;
  }
}
