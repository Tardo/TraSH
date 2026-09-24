// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import type {ArgDef, ParseInfo} from './interpreter';
import type {default as VMachine, EvalOptions} from './vmachine';
import type Frame from './frame';

export const FUNCTION_TYPE: {+[string]: number} = {
  Native: 1,
  Internal: 2,
  Command: 3,
};

export default class FunctionTrash {
  args: $ReadOnlyArray<ArgDef>;
  code: ParseInfo;
  closure: Frame | void;

  constructor(args: $ReadOnlyArray<ArgDef>, code: ParseInfo, closure?: Frame) {
    this.args = args;
    this.code = code;
    this.closure = closure?.capture();
  }

  toString(): string {
    return `[FunctionTrash]`;
  }

  async exec(vmachine: VMachine, kwargs: {[string]: mixed}, frame: Frame, opts: EvalOptions): Promise<mixed> {
    frame.prevFrame = this.closure;
    frame.locals = Object.assign(Object.create(null), kwargs);
    frame.stack.length = 0;
    return await vmachine.execute(this.code, opts, frame);
  }
}
