// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import {ARG} from './constants';
import {t} from './translation';
import type {ArgDef} from './interpreter';

export {ARG, t};

// Argument shapes are defined by each command's `args` metadata at runtime.
// $FlowFixMe[unclear-type]
export type PluginArguments = {[string]: any};
export type PluginContext = {
  callFunction: (fn: mixed, values: $ReadOnlyArray<mixed>) => Promise<mixed>,
  propertyKey: (key: mixed) => string | number,
  signal?: AbortSignal,
};
export type PluginCallback = (context: PluginContext, kwargs: PluginArguments) => Promise<mixed>;
export type PluginCommand = $ReadOnly<{
  definition?: string,
  callback: PluginCallback,
  options?: (argName: string) => Promise<$ReadOnlyArray<string>>,
  detail?: string,
  args?: $ReadOnlyArray<ArgDef>,
  secured?: boolean,
  unsafe?: boolean,
  aliases?: $ReadOnlyArray<string>,
  example?: string,
  category?: string,
}>;
export type PluginApi = {
  registerCommand: (name: string, command: PluginCommand) => void,
};
export type Plugin = (api: PluginApi) => void;
