// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

export default function (data: mixed): boolean {
  if (data === null || data === undefined || data === '') {
    return true;
  } else if (data instanceof Array) {
    return data.length === 0;
  } else if (typeof data === 'object') {
    return Object.keys(data).length === 0;
  }

  return false;
}
