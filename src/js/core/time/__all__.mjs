// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.
import funcSleep from './sleep';
import funcPNow from './pnow';
import type VMachine from '../../vmachine';

export default function (vm: VMachine) {
  vm.registerCommand('sleep', funcSleep());
  vm.registerCommand('pnow', funcPNow());
}
