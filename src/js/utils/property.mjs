// @flow strict
import InvalidValueError from '../exceptions/invalid_value_error';

export function propertyKey(key: mixed): string | number {
  if (
    (typeof key !== 'string' && typeof key !== 'number') ||
    key === '__proto__' ||
    key === 'constructor' ||
    key === 'prototype'
  ) {
    throw new InvalidValueError(key);
  }
  return key;
}

export function ownProperty(value: mixed, key: mixed): mixed {
  const name = propertyKey(key);
  if (value === null || typeof value === 'undefined') return undefined;
  // $FlowFixMe[incompatible-call]
  if (!Object.hasOwn(value, name)) return undefined;
  // $FlowFixMe[incompatible-use]
  return value[name];
}
