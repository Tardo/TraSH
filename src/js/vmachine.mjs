// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import * as i18n from './translation';
import {validateAndFormatArguments, getArgumentInputCount, getArgumentInfoByName, getArgumentInfo} from './argument';
import {INSTRUCTION_TYPE, INSTRUCTION_SIZE, ARG, LEXER} from './constants';
import {default as FunctionTrash, FUNCTION_TYPE} from './function';
import Frame from './frame';
import InvalidCommandArgumentFormatError from './exceptions/invalid_command_argument_format_error';
import InvalidCommandArgumentValueError from './exceptions/invalid_command_argument_value_error';
import InvalidCommandArgumentsError from './exceptions/invalid_command_arguments_error';
import InvalidInstructionError from './exceptions/invalid_instruction_error';
import InvalidNameError from './exceptions/invalid_name_error';
import InvalidTokenError from './exceptions/invalid_token_error';
import InvalidValueError from './exceptions/invalid_value_error';
import NotExpectedCommandArgumentError from './exceptions/not_expected_command_argument_error';
import UnknownCommandError from './exceptions/unknown_command_error';
import UnknownNameError from './exceptions/unknown_name_error';
import InvalidCommandDefintionError from './exceptions/invalid_command_definition_error';
import pluck from './utils/pluck';
import isNumber from './utils/is_number';
import {ownProperty, propertyKey} from './utils/property';
import ExecutionStoppedError from './exceptions/execution_stopped_error';
import type {RegisteredCMD, CMDDef, ParseInfo, CMDCallbackArgs, TokenInfo, ArgDef} from './interpreter';
import type {Plugin} from './plugin';

type FunctionHandle = {[string]: mixed};

export type ProcessCommandJobOptions = {
  cmdRaw: string,
  cmdName: string,
  cmdDef: CMDDef,
  kwargs: CMDCallbackArgs,
  args: Array<string>,
  signal?: AbortSignal,
  executionOptions: EvalOptions,
};
export type ProcessCommandJobCallback = (options: ProcessCommandJobOptions, silent: boolean) => Promise<mixed>;
export type VMachineOptions = {
  processCommandJob: ProcessCommandJobCallback,
  // Asked to confirm before an `unsafe` command/function actually runs. Returns
  // false to reject (execution aborts).
  confirmUnsafe?: (cmdName: string, cmdRaw: string) => Promise<boolean>,
  maxInstructions?: number,
  maxCollectionLength?: number,
  maxStringLength?: number,
};

export type EvalOptions = {
  // Propagate callback errors even for silent calls, without changing their output mode.
  throwSilentErrors?: boolean,
  isData?: boolean,
  silent?: boolean,
  aliases?: {[string]: string},
  maxInstructions?: number,
  signal?: AbortSignal,
};

// Placeholder used when an instruction has no source token attached
const DEFAULT_TOKEN: TokenInfo = {
  value: '',
  raw: '',
  type: LEXER.Unknown,
  start: -1,
  end: -1,
  index: -1,
};

export default class VMachine {
  #registeredCmds: RegisteredCMD = Object.setPrototypeOf({}, null);
  #globals: {[string]: mixed} = Object.setPrototypeOf({}, null);
  #executions: WeakMap<EvalOptions, {remaining: number, ticks: number}> = new WeakMap();
  #functionHandles: WeakMap<{...}, FunctionHandle> = new WeakMap();
  #functionValues: WeakMap<{...}, CMDDef> = new WeakMap();
  options: VMachineOptions;

  constructor(options: VMachineOptions) {
    for (const [name, value] of [
      ['maxCollectionLength', options.maxCollectionLength],
      ['maxStringLength', options.maxStringLength],
    ]) {
      if (typeof value !== 'undefined' && (!Number.isSafeInteger(value) || value < 1)) {
        throw new RangeError(`${name} must be a positive safe integer`);
      }
    }
    this.options = options;
  }

  getRegisteredCmds(): RegisteredCMD {
    return this.#registeredCmds;
  }

  static makeCommand(cmd_def: Partial<CMDDef>): CMDDef {
    return {
      definition: i18n.t('terminal.cmd.default.definition', 'Undefined command'),
      callback: () => {
        return this.#fallbackExecuteCommand();
      },
      options: () => {
        return this.#fallbackCommandOptions();
      },
      detail: i18n.t('terminal.cmd.default.detail', "This command hasn't a properly detailed information"),
      args: [],
      secured: false,
      unsafe: false,
      aliases: [],
      example: '',
      type: FUNCTION_TYPE.Command,
      category: 'core',
      ...cmd_def,
    };
  }

  cleanGlobals() {
    this.#globals = Object.setPrototypeOf({}, null);
  }

  registerCommand(cmd: string, cmd_def: Partial<CMDDef>): CMDDef {
    const definition = VMachine.makeCommand(cmd_def);
    this.#registeredCmds[cmd] = definition;
    this.#functionHandle(definition);
    return this.#registeredCmds[cmd];
  }

  #functionHandle(definition: CMDDef): FunctionHandle {
    let handle = this.#functionHandles.get(definition);
    if (typeof handle === 'undefined') {
      handle = {};
      this.#functionHandles.set(definition, handle);
      // Keep invocation metadata private. Script-visible handles can be changed
      // freely without changing the capability they represent.
      const args = definition.args.map(arg => {
        const copy = [...arg];
        copy[1] = [...arg[1]];
        if (Array.isArray(arg[5])) copy[5] = [...arg[5]];
        return copy;
      });
      this.#functionValues.set(handle, {...definition, args});
    }
    return handle;
  }

  #functionDefinition(value: mixed): CMDDef | void {
    if (value === null || typeof value !== 'object') return undefined;
    return this.#functionValues.get(value);
  }

  #functionHandleFor(value: mixed): FunctionHandle | void {
    if (value === null || typeof value !== 'object') return undefined;
    return this.#functionHandles.get(value);
  }

  #stringValue(value: mixed): string {
    if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
      throw new InvalidValueError(value);
    }
    const stringValue = String(value);
    if (stringValue.length > (this.options.maxStringLength ?? 1_000_000)) {
      throw new RangeError('String value exceeds maxStringLength');
    }
    return stringValue;
  }

  #addValues(left: mixed, right: mixed): mixed {
    if (typeof left === 'string' || typeof right === 'string') {
      const result = `${this.#stringValue(left)}${this.#stringValue(right)}`;
      if (result.length > (this.options.maxStringLength ?? 1_000_000)) {
        throw new RangeError('String value exceeds maxStringLength');
      }
      return result;
    }
    if (typeof left === 'number' && typeof right === 'number') return left + right;
    throw new InvalidValueError(typeof left !== 'number' ? left : right);
  }

  #applyAssignment(type: number, current: mixed, value: mixed): mixed {
    if (type === LEXER.AssignmentAdd || type === LEXER.Increment) return this.#addValues(current, value);
    if (typeof current !== 'number' || typeof value !== 'number') {
      throw new InvalidValueError(typeof current !== 'number' ? current : value);
    }
    if (type === LEXER.AssignmentSubstract || type === LEXER.Decrement) return current - value;
    if (type === LEXER.AssignmentMultiply) return current * value;
    return current / value;
  }

  #validateSubscriptWrite(data: mixed, key: string | number, value: mixed): void {
    if (data === null || typeof data !== 'object') {
      throw new InvalidValueError(data);
    }
    if (!Array.isArray(data)) return;
    const limit = this.options.maxCollectionLength ?? 100_000;
    if (key === 'length') {
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > limit) {
        throw new RangeError('Array length exceeds maxCollectionLength');
      }
      return;
    }
    const index = typeof key === 'number' ? key : Number(key);
    if (Number.isSafeInteger(index) && index >= 0 && String(index) === String(key) && index + 1 > limit) {
      throw new RangeError('Array length exceeds maxCollectionLength');
    }
  }

  use(plugin: Plugin): void {
    plugin({
      registerCommand: (name, command) => {
        this.registerCommand(name, {
          ...command,
          type: FUNCTION_TYPE.Internal,
          callback: async (vmachine: VMachine, kwargs: CMDCallbackArgs, frame: Frame, opts: EvalOptions) =>
            command.callback(
              {
                callFunction: (fn, values) => vmachine.callFunctionValue(fn, values, frame, opts),
                propertyKey,
                signal: opts.signal,
              },
              kwargs,
            ),
        });
      },
    });
  }

  // Invoke a function value (e.g. a `$$var` reference or an inline anonymous
  // function) with positional arguments. A fresh Frame is used so the caller's
  // own frame (still needed by the outer execute loop) is never mutated.
  async callFunctionValue(fn: mixed, values: $ReadOnlyArray<mixed>, frame: Frame, opts: EvalOptions): Promise<mixed> {
    if (fn === null || typeof fn !== 'object') {
      throw new InvalidValueError(fn);
    }
    const definition = this.#functionDefinition(fn);
    if (typeof definition === 'undefined') throw new InvalidValueError(fn);
    const fn_args: $ReadOnlyArray<ArgDef> = definition.args;
    const call_frame = new Frame(undefined, frame);
    call_frame.stack = values.slice(0, fn_args.length);
    return await this.#invokeFunction(opts, call_frame, '<callback>', definition, '', false);
  }

  static async #fallbackExecuteCommand(): Promise<> {
    throw new InvalidCommandDefintionError();
  }

  static async #fallbackCommandOptions(): Promise<$ReadOnlyArray<string>> {
    return [];
  }

  async #genKwargs(opts: EvalOptions, frame: Frame, name: string, cmd_def: CMDDef): Promise<{[string]: mixed}> {
    let kwargs: {[string]: mixed} = Object.setPrototypeOf({}, null);
    // Resolve each named argument to its first matching definition (same
    // resolution as getArgumentInfoByName, which tolerates duplicated names)
    const arg_defs: Array<ArgDef> = [];
    for (const farg of frame.args) {
      const matched_def = cmd_def.args.find(arg => arg[1].includes(farg));
      if (typeof matched_def !== 'undefined' && !arg_defs.includes(matched_def)) {
        arg_defs.push(matched_def);
      }
    }
    if (getArgumentInputCount(arg_defs) > frame.args.length) {
      throw new InvalidCommandArgumentsError(name, frame.args);
    }
    const flags = frame.args.filter(
      arg_name => getArgumentInfoByName(cmd_def.args, arg_name)?.type === ARG.Flag,
    ).length;
    const items_len = Math.max(frame.stack.length + flags, frame.args.length);
    if (getArgumentInputCount(arg_defs, true) > items_len) {
      throw new InvalidCommandArgumentsError(name, frame.args);
    }
    let arg_def;
    const {stack} = frame;
    for (let index = items_len - 1, adone = stack.length - 1; index >= 0; --index) {
      let arg_name = frame.args.pop();
      if (typeof arg_name === 'undefined' || !arg_name) {
        arg_def = getArgumentInfo(cmd_def.args[index]);
        if (!arg_def) {
          throw new InvalidCommandArgumentValueError(name, stack[adone--]);
        }
        arg_name = arg_def.names.long;
      } else {
        arg_def = getArgumentInfoByName(cmd_def.args, arg_name);
        if (!arg_def) {
          throw new InvalidCommandArgumentValueError(name, stack[adone--]);
        }
      }
      kwargs[arg_name] = arg_def.type === ARG.Flag ? true : stack[adone--];
    }

    try {
      kwargs = await validateAndFormatArguments(cmd_def, kwargs, this, opts, frame);
    } catch (err) {
      if (err instanceof ExecutionStoppedError) throw err;
      throw new InvalidCommandArgumentFormatError(err.message, name);
    }
    return kwargs;
  }

  async #invokeFunction(
    opts: EvalOptions,
    frame: Frame,
    name: string,
    cmd_def: CMDDef,
    cmdRaw: string,
    silent: boolean,
  ): Promise<mixed> {
    // Execution-time safety gate.
    if (cmd_def?.unsafe === true && this.options.confirmUnsafe) {
      const approved = await this.options.confirmUnsafe(name, cmdRaw);
      if (!approved) {
        throw new Error(i18n.t('trash.vmachine.unsafeRejected', "Command '{{cmd}}' rejected by user", {cmd: name}));
      }
    }
    let kwargs: {[string]: mixed} = {};
    if (typeof cmd_def !== 'undefined') {
      // Defaults use the same lexical environment as the function body.
      if (cmd_def.type === FUNCTION_TYPE.Native) frame.prevFrame = cmd_def.closure;
      kwargs = await this.#genKwargs(opts, frame, name, cmd_def);
      if (opts.signal?.aborted) throw new ExecutionStoppedError('Execution aborted');
      if (cmd_def.type !== FUNCTION_TYPE.Command) {
        if (typeof cmd_def.callback === 'undefined') {
          throw new InvalidCommandDefintionError();
        }
        let internal_res;
        try {
          const internal_cb = cmd_def.callback;
          // $FlowFixMe[extra-arg]
          // $FlowFixMe[class-object-subtyping]
          internal_res = await internal_cb(this, kwargs, frame, opts);
        } catch (err) {
          if (!silent || opts.throwSilentErrors === true || err instanceof ExecutionStoppedError) {
            throw err;
          }
          return null;
        }
        return this.#functionHandleFor(internal_res) ?? internal_res;
      }
    }

    try {
      const result = await this.options.processCommandJob(
        {
          cmdRaw,
          cmdName: name,
          cmdDef: cmd_def,
          kwargs: kwargs,
          args: frame.stack.map(item => this.#stringValue(item)),
          signal: opts.signal,
          executionOptions: opts,
        },
        silent,
      );
      return this.#functionHandleFor(result) ?? result;
    } catch (err) {
      if (!silent || opts.throwSilentErrors === true || err instanceof ExecutionStoppedError) throw err;
      return null;
    }
  }

  async execute(parse_info: ParseInfo, opts?: EvalOptions, aframe?: Frame, collectAll?: boolean): Promise<mixed> {
    const {program} = parse_info;
    const sopts = {
      isData: false,
      silent: false,
      aliases: {},
      ...opts,
    };
    let execution = opts ? this.#executions.get(opts) : undefined;
    if (!execution) {
      const limit = sopts.maxInstructions ?? this.options.maxInstructions ?? 1_000_000;
      if (!Number.isSafeInteger(limit) || limit < 1)
        throw new RangeError('maxInstructions must be a positive safe integer');
      execution = {remaining: limit, ticks: 0};
    }
    this.#executions.set(sopts, execution);
    const signal = sopts.signal;
    if (signal?.aborted) throw new ExecutionStoppedError('Execution aborted');
    const {instructions, constants, sourceMap} = program;
    const bytecode = new DataView(instructions.buffer, instructions.byteOffset, instructions.byteLength);
    const instrLen = instructions.length / INSTRUCTION_SIZE;
    let rootFrame = aframe;
    if (typeof rootFrame === 'undefined') {
      rootFrame = new Frame();
      rootFrame.locals = this.#globals;
    }
    const callStack = [];
    let eoe = false;
    let activeFrame = rootFrame;
    // Tokens are only needed by a few instructions (mostly on error paths),
    // so they are resolved on demand instead of once per instruction
    const getToken = (index: number): TokenInfo =>
      sourceMap[index * 2 + 1] >= 0
        ? parse_info.inputTokens[sourceMap[index * 2]][sourceMap[index * 2 + 1]]
        : DEFAULT_TOKEN;
    for (let index = 0; !eoe && index < instrLen; ++index) {
      if (--execution.remaining < 0) throw new ExecutionStoppedError('Instruction limit exceeded');
      if (++execution.ticks === 65_536) {
        execution.ticks = 0;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (signal?.aborted) throw new ExecutionStoppedError('Execution aborted');
      const opcode = instructions[index * INSTRUCTION_SIZE];
      const operand = bytecode.getInt32(index * INSTRUCTION_SIZE + 1, true);
      switch (opcode) {
        case INSTRUCTION_TYPE.LOAD_NAME_CALLEABLE:
        case INSTRUCTION_TYPE.LOAD_NAME:
          {
            const var_name = constants[operand];
            if (typeof var_name !== 'string') throw new InvalidInstructionError();
            if (opcode === INSTRUCTION_TYPE.LOAD_NAME_CALLEABLE) {
              activeFrame = new Frame('__anon__', activeFrame);
              callStack.push(activeFrame);
            }
            // Check locals
            const owner_frame = activeFrame.resolveLocal(var_name);
            if (typeof owner_frame === 'undefined') {
              const token = getToken(index);
              throw new UnknownNameError(var_name, token.start, token.end);
            }
            activeFrame.stack.push(owner_frame.locals[var_name]);
          }
          break;
        case INSTRUCTION_TYPE.LOAD_GLOBAL:
          {
            const cmd_name = constants[operand];
            if (typeof cmd_name !== 'string') {
              const token = getToken(index);
              throw new UnknownNameError(
                i18n.t('UnknownNameError.invalidName', '<InvalidName>'),
                token.start,
                token.end,
              );
            } else if (Object.hasOwn(this.#registeredCmds, cmd_name) || Object.hasOwn(sopts.aliases, cmd_name)) {
              activeFrame = new Frame(cmd_name, activeFrame);
              callStack.push(activeFrame);
            } else {
              const token = getToken(index);
              throw new UnknownCommandError(cmd_name, token.start, token.end);
            }
          }
          break;
        case INSTRUCTION_TYPE.LOAD_CONST:
          {
            const value = constants[operand];
            activeFrame.stack.push(value);
          }
          break;
        case INSTRUCTION_TYPE.LOAD_ARG:
          {
            const token = getToken(index);
            const arg_name = token.value;
            if (!activeFrame) {
              throw new NotExpectedCommandArgumentError(arg_name, token.start, token.end);
            }
            if (typeof arg_name === 'string') {
              activeFrame.args.push(arg_name);
            } else {
              throw new InvalidValueError(arg_name);
            }
          }
          break;
        case INSTRUCTION_TYPE.UNITARY_NEGATIVE:
          {
            const val = activeFrame.stack.pop();
            if (typeof val === 'number') {
              activeFrame.stack.push(val * -1);
            } else {
              throw new InvalidValueError(val);
            }
          }
          break;
        case INSTRUCTION_TYPE.ADD:
          {
            const valB = activeFrame.stack.pop();
            const valA = activeFrame.stack.pop();
            if (typeof valA === 'string' || typeof valB === 'string') {
              activeFrame.stack.push(this.#addValues(valA, valB));
            } else if (typeof valA === 'number' && typeof valB === 'number') {
              activeFrame.stack.push(valA + valB);
            } else if (typeof valA !== 'number') {
              throw new InvalidValueError(valA);
            } else {
              throw new InvalidValueError(valB);
            }
          }
          break;
        case INSTRUCTION_TYPE.SUBSTRACT:
        case INSTRUCTION_TYPE.MULTIPLY:
        case INSTRUCTION_TYPE.DIVIDE:
        case INSTRUCTION_TYPE.MODULO:
          {
            const valB = activeFrame.stack.pop();
            const valA = activeFrame.stack.pop();
            if (typeof valB !== 'number') {
              throw new InvalidValueError(valB);
            }
            if (typeof valA !== 'number') {
              throw new InvalidValueError(valA);
            }
            if (opcode === INSTRUCTION_TYPE.SUBSTRACT) {
              activeFrame.stack.push(valA - valB);
            } else if (opcode === INSTRUCTION_TYPE.MULTIPLY) {
              activeFrame.stack.push(valA * valB);
            } else if (opcode === INSTRUCTION_TYPE.DIVIDE) {
              activeFrame.stack.push(valA / valB);
            } else if (opcode === INSTRUCTION_TYPE.MODULO) {
              activeFrame.stack.push(valA % valB);
            }
          }
          break;
        case INSTRUCTION_TYPE.AND:
        case INSTRUCTION_TYPE.OR:
        case INSTRUCTION_TYPE.EQUAL:
        case INSTRUCTION_TYPE.NOT_EQUAL:
          {
            const valB = activeFrame.stack.pop();
            const valA = activeFrame.stack.pop();
            if (opcode === INSTRUCTION_TYPE.AND) {
              // $FlowFixMe[sketchy-null-mixed]
              activeFrame.stack.push(valA && valB);
            } else if (opcode === INSTRUCTION_TYPE.OR) {
              // $FlowFixMe[sketchy-null-mixed]
              activeFrame.stack.push(valA || valB);
            } else if (opcode === INSTRUCTION_TYPE.EQUAL) {
              activeFrame.stack.push(valA === valB);
            } else if (opcode === INSTRUCTION_TYPE.NOT_EQUAL) {
              activeFrame.stack.push(valA !== valB);
            }
          }
          break;
        case INSTRUCTION_TYPE.GREATER_THAN_OPEN:
        case INSTRUCTION_TYPE.LESS_THAN_OPEN:
        case INSTRUCTION_TYPE.GREATER_THAN_CLOSED:
        case INSTRUCTION_TYPE.LESS_THAN_CLOSED:
          {
            const valB = activeFrame.stack.pop();
            const valA = activeFrame.stack.pop();

            if (typeof valB !== 'number') {
              throw new InvalidValueError(valB);
            }
            if (typeof valA !== 'number') {
              throw new InvalidValueError(valA);
            }

            if (opcode === INSTRUCTION_TYPE.GREATER_THAN_OPEN) {
              activeFrame.stack.push(valA > valB);
            } else if (opcode === INSTRUCTION_TYPE.LESS_THAN_OPEN) {
              activeFrame.stack.push(valA < valB);
            } else if (opcode === INSTRUCTION_TYPE.GREATER_THAN_CLOSED) {
              activeFrame.stack.push(valA >= valB);
            } else if (opcode === INSTRUCTION_TYPE.LESS_THAN_CLOSED) {
              activeFrame.stack.push(valA <= valB);
            }
          }
          break;
        case INSTRUCTION_TYPE.NOT:
          {
            const val = activeFrame.stack.pop();
            activeFrame.stack.push(!val);
          }
          break;
        case INSTRUCTION_TYPE.CALL_FUNCTION_SILENT:
        case INSTRUCTION_TYPE.CALL_FUNCTION:
          {
            const frame = callStack.pop();
            if (typeof frame?.cmd !== 'undefined') {
              const frame_cmd = frame.cmd;
              let cmd_def = this.#registeredCmds[frame_cmd];
              if (typeof cmd_def === 'undefined') {
                // FIXME: Done in this way to support 'aliases'
                if (
                  !Object.hasOwn(sopts.aliases, frame_cmd) &&
                  frame.stack[0] !== null &&
                  typeof frame.stack[0] === 'object'
                ) {
                  // When $$var fires at argument position (no args on the frame yet) and the
                  // referenced function expects arguments, treat it as a reference pass so
                  // Higher-order plugin callbacks receive the current execution options.
                  // Zero-arg functions ($$RMOD, $$mop, etc.) are still called immediately.
                  if (frame.stack.length === 1 && frame.args.length === 0) {
                    const fn_args_len: number = this.#functionDefinition(frame.stack[0])?.args.length ?? 0;
                    if (fn_args_len > 0) {
                      activeFrame = callStack.at(-1) || rootFrame;
                      activeFrame.stack.push(frame.stack[0]);
                      break;
                    }
                  }
                  const functionValue = frame.stack.shift();
                  if (functionValue === null || typeof functionValue !== 'object') {
                    throw new InvalidValueError(functionValue);
                  }
                  const functionDefinition = this.#functionDefinition(functionValue);
                  if (typeof functionDefinition === 'undefined') throw new InvalidValueError(functionValue);
                  cmd_def = functionDefinition;
                }
              }
              // Subframes are executed in silent mode
              const ret = await this.#invokeFunction(
                sopts,
                frame,
                frame_cmd,
                cmd_def,
                parse_info.inputRawString,
                opcode === INSTRUCTION_TYPE.CALL_FUNCTION_SILENT || sopts.silent === true,
              );
              activeFrame = callStack.at(-1) || rootFrame;
              activeFrame.stack.push(ret);
            }
          }
          break;
        case INSTRUCTION_TYPE.RETURN_VALUE:
          {
            const frame = callStack.pop() || rootFrame;
            activeFrame = callStack.at(-1) || rootFrame;
            activeFrame.stack.push(frame.stack.pop());
            eoe = true;
          }
          break;
        case INSTRUCTION_TYPE.STORE_NAME:
          {
            const token = getToken(index);
            const vname = constants[operand];
            // An empty stack means a malformed assignment (e.g. '$x ='); a popped
            // 'undefined' is now a legit value (missing dict/array member access)
            const has_value = activeFrame.stack.length > 0;
            const vvalue = activeFrame.stack.pop();
            if (typeof vname !== 'string') {
              if (!token) {
                throw new InvalidInstructionError();
              }
              throw new InvalidNameError(token.value, token.start, token.end);
            } else if (!has_value) {
              const value_token = getToken(index - 1);
              throw new InvalidTokenError(value_token.value, value_token.start, value_token.end);
            } else {
              if (
                token.type === LEXER.AssignmentAdd ||
                token.type === LEXER.AssignmentSubstract ||
                token.type === LEXER.AssignmentMultiply ||
                token.type === LEXER.AssignmentDivide ||
                token.type === LEXER.Increment ||
                token.type === LEXER.Decrement
              ) {
                const stored_value = activeFrame.getLocal(vname);
                if (typeof stored_value === 'undefined') {
                  throw new InvalidNameError(vname, token.start, token.end);
                }

                activeFrame.setLocal(vname, this.#applyAssignment(token.type, stored_value, vvalue));
              } else {
                activeFrame.setLocal(vname, vvalue);
              }
            }
          }
          break;
        case INSTRUCTION_TYPE.STORE_SUBSCR:
          {
            const token = getToken(index);
            const attr_value = activeFrame.stack.pop();
            const attr_name = propertyKey(activeFrame.stack.pop());
            const data = activeFrame.stack.pop();
            try {
              this.#validateSubscriptWrite(data, attr_name, attr_value);
              // $FlowFixMe[incompatible-type]
              const data_obj: {[mixed]: mixed} = data;
              if (token.type !== LEXER.Assignment) {
                data_obj[attr_name] = this.#applyAssignment(token.type, data_obj[attr_name], attr_value);
              } else {
                data_obj[attr_name] = attr_value;
              }
              // activeFrame.setLocal(vname, data);
              activeFrame.stack.push(data);
            } catch (err) {
              throw new InvalidInstructionError(err.message);
            }
          }
          break;
        case INSTRUCTION_TYPE.LOAD_DATA_ATTR:
          {
            const attr_name = propertyKey(activeFrame.stack.pop());
            const index_value = activeFrame.stack.length - 1;
            const value = activeFrame.stack[index_value];

            if (value === null || typeof value === 'undefined') {
              throw new InvalidValueError(typeof attr_name === 'string' ? attr_name : 'Unknown');
            }

            // Missing properties/indexes resolve to 'undefined' (JS-like), not null
            let res_value: mixed;
            try {
              res_value = ownProperty(value, attr_name);
            } catch (_err) {
              // Do nothing
            }
            if (res_value === null || typeof res_value === 'undefined') {
              if (typeof attr_name === 'string' && !isNumber(attr_name) && value instanceof Array) {
                const plucked = pluck(value, attr_name);
                if (!plucked.every(item => typeof item === 'undefined')) {
                  res_value = plucked;
                }
              }
            }
            activeFrame.stack[index_value] = res_value;
          }
          break;
        case INSTRUCTION_TYPE.BUILD_LIST:
          {
            const iter_count = operand;
            if (iter_count > (this.options.maxCollectionLength ?? 100_000)) {
              throw new RangeError('Collection exceeds maxCollectionLength');
            }
            const value = [];
            for (let i = 0; i < iter_count; ++i) {
              value.push(activeFrame.stack.pop());
            }
            activeFrame.stack.push(value.reverse());
          }
          break;
        case INSTRUCTION_TYPE.BUILD_MAP:
          {
            const iter_count = operand;
            if (iter_count > (this.options.maxCollectionLength ?? 100_000)) {
              throw new RangeError('Collection exceeds maxCollectionLength');
            }
            const value: {[mixed]: mixed} = {};
            for (let i = 0; i < iter_count; ++i) {
              const val = activeFrame.stack.pop();
              const key = propertyKey(activeFrame.stack.pop());
              value[key] = val;
            }
            activeFrame.stack.push(value);
          }
          break;
        case INSTRUCTION_TYPE.PUSH_FRAME:
          activeFrame = new Frame(undefined, activeFrame);
          callStack.push(activeFrame);
          break;
        case INSTRUCTION_TYPE.POP_FRAME:
          callStack.pop();
          activeFrame = callStack.at(-1) || rootFrame;
          break;
        case INSTRUCTION_TYPE.MAKE_FUNCTION:
          {
            const name = activeFrame.stack.pop();
            const args = activeFrame.stack.pop();
            const code = activeFrame.stack.pop();
            if (Array.isArray(args) && code !== null && typeof code === 'object') {
              // $FlowFixMe[incompatible-indexer]
              // $FlowFixMe[incompatible-variance]
              // $FlowFixMe[incompatible-call]
              const trash_func = new FunctionTrash(args, code, activeFrame);
              // $FlowFixMe[method-unbinding]
              const exec_bound = trash_func.exec.bind(trash_func);
              const cmd_def: Partial<CMDDef> = {
                closure: trash_func.closure,
                callback: exec_bound,
                type: FUNCTION_TYPE.Native,
                args: trash_func.args,
                definition: i18n.t('trash.vmachine.func.definition', 'Internal function'),
                detail: i18n.t('trash.vmachine.func.detail', 'Internal function'),
              };
              if (typeof name === 'string') {
                if (Object.hasOwn(this.#registeredCmds, name)) {
                  throw new Error(`Cannot replace registered command '${name}'`);
                }
                this.registerCommand(name, cmd_def);
              } else {
                activeFrame.stack.push(this.#functionHandle(VMachine.makeCommand(cmd_def)));
              }
            }
          }
          break;
        case INSTRUCTION_TYPE.JUMP_IF_FALSE:
          {
            activeFrame.lastFlowCheck = activeFrame.stack.at(-1);
            const num_to_skip = operand;
            if (
              typeof activeFrame.lastFlowCheck === 'undefined' ||
              activeFrame.lastFlowCheck === null ||
              !activeFrame.lastFlowCheck
            ) {
              index += num_to_skip;
            }
          }
          break;
        case INSTRUCTION_TYPE.JUMP_IF_FALSE_POP:
          {
            activeFrame.lastFlowCheck = activeFrame.stack.pop();
            const num_to_skip = operand;
            if (
              typeof activeFrame.lastFlowCheck === 'undefined' ||
              activeFrame.lastFlowCheck === null ||
              !activeFrame.lastFlowCheck
            ) {
              index += num_to_skip;
            }
          }
          break;
        case INSTRUCTION_TYPE.JUMP_IF_TRUE:
          {
            const num_to_skip = operand;
            if (
              typeof activeFrame.lastFlowCheck !== 'undefined' &&
              activeFrame.lastFlowCheck !== null &&
              activeFrame.lastFlowCheck
            ) {
              index += num_to_skip;
            }
          }
          break;
        case INSTRUCTION_TYPE.JUMP_BACKWARD:
          {
            const num_to_back = operand;
            index -= num_to_back + 1;
          }
          break;
        case INSTRUCTION_TYPE.JUMP_FORWARD:
          {
            const num_to_adv = operand;
            if (num_to_adv > 0) {
              index += num_to_adv;
            }
          }
          break;
      }
    }
    if (signal?.aborted) throw new ExecutionStoppedError('Execution aborted');
    if (collectAll === true && activeFrame.stack.length > 1) {
      return [...activeFrame.stack];
    }
    return activeFrame.stack.pop();
  }
}
