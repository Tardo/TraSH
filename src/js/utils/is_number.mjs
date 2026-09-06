// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

export default function (value: mixed): boolean {
  if (value === null || value === ' ') return false;
  if (typeof value === 'string' && value.length === 1) {
    const code = value.charCodeAt(0);
    return code >= 48 && code <= 57;
  }
  return !isNaN(Number(value));
}
