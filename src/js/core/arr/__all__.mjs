// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import funcArrClone from './arr_clone';
import funcArrAppend from './arr_append';
import funcArrPrepend from './arr_prepend';
import funcArrJoin from './arr_join';
import funcArrMap from './arr_map';
import funcArrFilter from './arr_filter';
import funcArrReduce from './arr_reduce';
import type VMachine from '../../vmachine';

export default function (vm: VMachine) {
  vm.registerCommand('arr_clone', funcArrClone());
  vm.registerCommand('arr_append', funcArrAppend());
  vm.registerCommand('arr_prepend', funcArrPrepend());
  vm.registerCommand('arr_join', funcArrJoin());
  vm.registerCommand('arr_map', funcArrMap());
  vm.registerCommand('arr_filter', funcArrFilter());
  vm.registerCommand('arr_reduce', funcArrReduce());
}
