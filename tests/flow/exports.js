// @flow strict

import {FUNCTION_TYPE, Interpreter, VMachine} from '@tardo/trash';
import type {CMDDef, ParserOptions, VMachineOptions} from '@tardo/trash';
import type {CMDCallbackInternal, ProcessCommandJobOptions, Translator} from '@tardo/trash';
import VMachineDirect from '@tardo/trash/vmachine';
import {ARG as PluginARG} from '@tardo/trash/plugin';
import type {Plugin} from '@tardo/trash/plugin';
import type {ProcessCommandJobOptions as DirectJobOptions} from '@tardo/trash/vmachine';

const options: VMachineOptions = {
  processCommandJob: async () => null,
};
const vmachine = new VMachine(options);
const interpreter = new Interpreter();
const command: Partial<CMDDef> = {type: FUNCTION_TYPE.Command};
const parserOptions: ParserOptions = {registeredCmds: vmachine.getRegisteredCmds()};

vmachine.registerCommand('command', command);
interpreter.parse("command 'flow'", parserOptions);
vmachine.execute(interpreter.parse('1', parserOptions));
new VMachineDirect(options);

export const plugin: Plugin = api => {
  api.registerCommand('identity', {
    args: [[PluginARG.Any, ['v', 'value'], true, 'Value to return']],
    callback: async (_context, {value}) => value,
  });
};

export const callback: CMDCallbackInternal = async (vm, kwargs, frame, opts) => frame.getLocal('value');
export const translator: Translator = (key, fallback) => fallback;
export const jobOptions = (job: ProcessCommandJobOptions): DirectJobOptions => job;

// $FlowExpectedError[incompatible-type]
const invalidOptions: VMachineOptions = {processCommandJob: 42};
const invalidJob: DirectJobOptions = {
  // $FlowExpectedError[incompatible-type]
  cmdRaw: 42,
  cmdName: '',
  cmdDef: VMachine.makeCommand({}),
  kwargs: {},
  args: [],
  executionOptions: {throwSilentErrors: true},
};
