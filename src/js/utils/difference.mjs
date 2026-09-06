// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

export default function <T>(list_a: Array<T>, list_b: Array<T>): Array<T> {
  return list_a.filter(x => !list_b.includes(x));
}
