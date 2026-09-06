// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.
import funcFetch from './fetch';
import type VMachine from '../../vmachine';

export default function (vm: VMachine) {
  vm.registerCommand('fetch', funcFetch());
}
