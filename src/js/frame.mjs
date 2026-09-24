// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import UnknownStoreValue from './exceptions/unknown_store_value';

export default class Frame {
  cmd: string | void;
  locals: {[string]: mixed};
  args: Array<string>;
  stack: Array<mixed>;
  prevFrame: Frame | void;
  lastFlowCheck: mixed | void;

  constructor(cmd_name: string | void, prev_frame: Frame | void) {
    this.cmd = cmd_name;
    this.locals = Object.setPrototypeOf({}, null);
    this.args = [];
    this.stack = [];
    this.prevFrame = prev_frame;
    this.lastFlowCheck = undefined;
  }

  resolveLocal(var_name: string): Frame | void {
    let cur_frame: Frame | void = this;
    while (typeof cur_frame !== 'undefined') {
      if (Object.hasOwn(cur_frame.locals, var_name)) {
        return cur_frame;
      }
      cur_frame = cur_frame.prevFrame;
    }
    return undefined;
  }

  capture(): Frame {
    // Share bindings, not stacks or mutable call-frame links.
    const closure = new Frame();
    closure.locals = this.locals;
    let target = closure;
    let source = this.prevFrame;
    while (typeof source !== 'undefined') {
      const parent = new Frame();
      parent.locals = source.locals;
      target.prevFrame = parent;
      target = parent;
      source = source.prevFrame;
    }
    return closure;
  }

  getLocal(var_name: string): mixed {
    const owner_frame = this.resolveLocal(var_name);
    if (typeof owner_frame === 'undefined') {
      throw new UnknownStoreValue(var_name);
    }
    return owner_frame.locals[var_name];
  }

  setLocal(var_name: string, value: mixed) {
    const owner_frame = this.resolveLocal(var_name) || this;
    owner_frame.locals[var_name] = value;
  }
}
