// @flow strict

import {FUNCTION_TYPE, Interpreter, VMachine, registerStr} from '@tardo/trash';
import type {CMDDef, ParserOptions, VMachineOptions} from '@tardo/trash';
import type {CMDCallbackInternal, ProcessCommandJobOptions, Translator} from '@tardo/trash';
import VMachineDirect from '@tardo/trash/vmachine';
import registerMath from '@tardo/trash/core/math/__all__';
import type {ProcessCommandJobOptions as DirectJobOptions} from '@tardo/trash/vmachine';

const options: VMachineOptions = {
  processCommandJob: async () => null,
};
const vmachine = new VMachine(options);
const interpreter = new Interpreter();
const command: Partial<CMDDef> = {type: FUNCTION_TYPE.Command};
const parserOptions: ParserOptions = {registeredCmds: vmachine.getRegisteredCmds()};

vmachine.registerCommand('command', command);
registerStr(vmachine);
interpreter.parse("str_upper 'flow'", parserOptions);
vmachine.execute(interpreter.parse('1', parserOptions));
registerMath(new VMachineDirect(options));

export const callback: CMDCallbackInternal = async (vm, kwargs, frame, opts) => frame.getLocal('value');
export const translator: Translator = (key, fallback) => fallback;
export const jobOptions = (job: ProcessCommandJobOptions): DirectJobOptions => job;

// $FlowExpectedError[incompatible-type]
const invalidOptions: VMachineOptions = {processCommandJob: 42};
// $FlowExpectedError[incompatible-type]
const invalidJob: DirectJobOptions = {cmdRaw: 42, cmdName: '', cmdDef: VMachine.makeCommand({}), kwargs: {}, args: []};
