// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

export {default as Frame} from './frame';
export {default as FunctionTrash, FUNCTION_TYPE} from './function';
export {default as Interpreter} from './interpreter';
export {default as VMachine} from './vmachine';
export type {
  ArgDef,
  ArgDefNames,
  ArgInfo,
  CMDCallback,
  CMDCallbackArgs,
  CMDCallbackContext,
  CMDCallbackInternal,
  CMDDef,
  CMDOptionsCallback,
  LexerInfo,
  ParserOptions,
  ParseInfo,
  RegisteredCMD,
  TokenInfo,
} from './interpreter';
export type {EvalOptions, ProcessCommandJobCallback, ProcessCommandJobOptions, VMachineOptions} from './vmachine';
export * from './translation';
export * from './argument';
export * from './constants';
export {default as registerArr} from './core/arr/__all__';
export {default as registerDict} from './core/dict/__all__';
export {default as registerEnde} from './core/ende/__all__';
export {default as registerMath} from './core/math/__all__';
export {default as registerNet} from './core/net/__all__';
export {default as registerStr} from './core/str/__all__';
export {default as registerTime} from './core/time/__all__';
