// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import {ownProperty} from './property';

export default function (list: Array<mixed>, skey: string): Array<mixed> {
  return list.map(item => ownProperty(item, skey));
}
