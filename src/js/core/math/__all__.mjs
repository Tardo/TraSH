// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.
import funcFloor from './floor';
import funcFixed from './fixed';
import funcRand from './rand';
import funcAbs from './abs';
import funcPow from './pow';
import type VMachine from '../../vmachine';

export default function (vm: VMachine) {
  vm.registerCommand('floor', funcFloor());
  vm.registerCommand('fixed', funcFixed());
  vm.registerCommand('rand', funcRand());
  vm.registerCommand('abs', funcAbs());
  vm.registerCommand('pow', funcPow());
}
