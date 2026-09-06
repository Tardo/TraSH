// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

export default function (value: mixed): boolean {
  return value === null || typeof value === 'undefined' || value === false || value === '';
}
