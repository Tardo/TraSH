// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.
import funcEncode from './encode';
import funcDecode from './decode';
import type VMachine from '../../vmachine';

export default function (vm: VMachine) {
  vm.registerCommand('encode', funcEncode());
  vm.registerCommand('decode', funcDecode());
}
