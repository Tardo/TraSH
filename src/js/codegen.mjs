// @flow strict
// Copyright  Alexandre Díaz <dev@redneboa.es>
// License MIT.

import {INSTRUCTION_TYPE, INSTRUCTION_SIZE, LEXER} from './constants';
import {NODE} from './ast';
import InvalidTokenError from './exceptions/invalid_token_error';
import type {ASTNode, ASTUnit, CommandArg} from './ast';
import type {ParseInfo, ParserOptions} from './interpreter';

const BINARY_INSTR: Map<number, number> = new Map([
  [LEXER.Add, INSTRUCTION_TYPE.ADD],
  [LEXER.Substract, INSTRUCTION_TYPE.SUBSTRACT],
  [LEXER.Multiply, INSTRUCTION_TYPE.MULTIPLY],
  [LEXER.Divide, INSTRUCTION_TYPE.DIVIDE],
  [LEXER.Modulo, INSTRUCTION_TYPE.MODULO],
  [LEXER.Equal, INSTRUCTION_TYPE.EQUAL],
  [LEXER.NotEqual, INSTRUCTION_TYPE.NOT_EQUAL],
  [LEXER.GreaterThanOpen, INSTRUCTION_TYPE.GREATER_THAN_OPEN],
  [LEXER.LessThanOpen, INSTRUCTION_TYPE.LESS_THAN_OPEN],
  [LEXER.GreaterThanClosed, INSTRUCTION_TYPE.GREATER_THAN_CLOSED],
  [LEXER.LessThanClosed, INSTRUCTION_TYPE.LESS_THAN_CLOSED],
  [LEXER.Or, INSTRUCTION_TYPE.OR],
]);

// Numeric compiler buffers are packed after jump backpatching. No instruction
// objects are allocated during compilation or execution.
export default class CodeGen {
  #instrs: Array<number> = [];
  #operands: Array<number> = [];
  #sources: Array<number> = [];
  #constants: Array<mixed> = [];
  #forinCount: number = 0;

  generate(data: string, root: ASTUnit, units: Array<ASTUnit>, options: ParserOptions): ParseInfo {
    this.#instrs = [];
    this.#operands = [];
    this.#sources = [];
    this.#constants = [];
    this.#forinCount = 0;

    this.#emitUnit(root);

    if (options?.noReturn === false || typeof options?.noReturn === 'undefined') {
      const last_instr = this.#instrs.at(-1);
      if (typeof last_instr !== 'undefined' && last_instr !== INSTRUCTION_TYPE.RETURN_VALUE) {
        this.#push(INSTRUCTION_TYPE.RETURN_VALUE, -1, -1);
      }
    }

    const instructions = new Uint8Array(this.#instrs.length * INSTRUCTION_SIZE);
    const view = new DataView(instructions.buffer);
    for (let index = 0; index < this.#instrs.length; ++index) {
      const operand = this.#operands[index];
      if (!Number.isInteger(operand) || operand < -0x80000000 || operand > 0x7fffffff) {
        throw new RangeError('Bytecode operand exceeds int32');
      }
      instructions[index * INSTRUCTION_SIZE] = this.#instrs[index];
      view.setInt32(index * INSTRUCTION_SIZE + 1, operand, true);
    }
    return {
      program: {
        instructions,
        constants: this.#constants,
        sourceMap: new Int32Array(this.#sources),
      },
      inputTokens: units.map(unit => unit.tokens),
      inputRawString: data,
      nestingDepth: units.length - 1,
    };
  }

  #push(type: number, token_index: number, level: number, operand: number = -1): number {
    this.#instrs.push(type);
    this.#operands.push(operand);
    this.#sources.push(level, token_index);
    return this.#instrs.length - 1;
  }

  #pushName(unit: ASTUnit, name: string | null): number {
    return this.#pushValue(unit, name);
  }

  #pushValue(_unit: ASTUnit, value: mixed): number {
    this.#constants.push(value);
    return this.#constants.length - 1;
  }

  #emitUnit(unit: ASTUnit): void {
    for (const stmt of unit.statements) {
      this.#emitStatement(unit, stmt);
    }
  }

  #ti(node: ASTNode): number {
    return typeof node.tokenIndex === 'number' ? node.tokenIndex : -1;
  }

  #emitStatement(unit: ASTUnit, stmt: ASTNode): void {
    switch (stmt.node) {
      case NODE.CommandCall:
      case NODE.VarCallStatement:
        this.#emitCall(unit, stmt);
        break;
      case NODE.Assignment:
        this.#emitAssignment(unit, stmt);
        break;
      case NODE.ExpressionStatement:
        if (stmt.expr) {
          this.#emitExpr(unit, stmt.expr, false);
        }
        break;
      case NODE.FunctionDef:
      case NODE.AnonFunction:
        this.#emitFunction(unit, stmt);
        break;
      case NODE.Return:
        if (stmt.expr) {
          this.#emitExpr(unit, stmt.expr, false);
        } else {
          const dindex = this.#pushValue(unit, null);
          this.#push(INSTRUCTION_TYPE.LOAD_CONST, this.#ti(stmt), unit.id, dindex);
        }
        this.#push(INSTRUCTION_TYPE.RETURN_VALUE, -1, -1);
        break;
      case NODE.Break:
        this.#push(INSTRUCTION_TYPE.JUMP_FORWARD, this.#ti(stmt), unit.id, -2);
        break;
      case NODE.Continue:
        this.#push(INSTRUCTION_TYPE.JUMP_FORWARD, this.#ti(stmt), unit.id, -1);
        break;
      case NODE.BlockStatement: {
        const block_unit = stmt.unit;
        if (block_unit) {
          this.#push(INSTRUCTION_TYPE.PUSH_FRAME, this.#ti(stmt), unit.id);
          this.#emitUnit(block_unit);
          this.#push(INSTRUCTION_TYPE.POP_FRAME, this.#ti(stmt), unit.id);
        }
        break;
      }
      case NODE.If:
        this.#emitIf(unit, stmt);
        break;
      case NODE.For:
        this.#emitFor(unit, stmt);
        break;
      case NODE.ForIn:
        this.#emitForIn(unit, stmt);
        break;
    }
  }

  #emitCall(unit: ASTUnit, stmt: ASTNode): void {
    const load_type =
      stmt.node === NODE.CommandCall ? INSTRUCTION_TYPE.LOAD_GLOBAL : INSTRUCTION_TYPE.LOAD_NAME_CALLEABLE;
    const dindex = this.#pushName(unit, stmt.name ?? null);
    this.#push(load_type, this.#ti(stmt), unit.id, dindex);
    const args: Array<CommandArg> = stmt.args || [];
    const silent = stmt.silent === true;
    for (const arg of args) {
      if (arg.argToken !== null) {
        this.#push(INSTRUCTION_TYPE.LOAD_ARG, arg.argTokenIndex, unit.id, -1);
      } else if (arg.value) {
        this.#emitExpr(unit, arg.value, silent);
      }
    }
    this.#push(silent ? INSTRUCTION_TYPE.CALL_FUNCTION_SILENT : INSTRUCTION_TYPE.CALL_FUNCTION, -1, unit.id);
  }

  #emitAssignment(unit: ASTUnit, stmt: ASTNode): void {
    const target = stmt.target;
    const token = stmt.token;
    if (!target || !token) {
      return;
    }
    let store_type;
    let store_operand;
    if (target.node === NODE.Variable) {
      store_operand = this.#pushName(unit, target.name ?? null);
      store_type = INSTRUCTION_TYPE.STORE_NAME;
    } else if (target.node === NODE.Subscript && target.base && target.index) {
      // Emit the full chain but omit the final LOAD_DATA_ATTR: STORE_SUBSCR
      // consumes [data, attr_name, value] from the stack.
      const target_base = target.base;
      const target_index = target.index;
      this.#emitExpr(unit, target_base, false);
      this.#emitUnit(target_index);
      store_operand = -1;
      store_type = INSTRUCTION_TYPE.STORE_SUBSCR;
    } else {
      throw new InvalidTokenError(token.value, token.start, token.end);
    }

    if (token.type === LEXER.Increment || token.type === LEXER.Decrement) {
      // ++/-- have no RHS token: inject the implicit constant 1
      const dindex = this.#pushValue(unit, 1);
      this.#push(INSTRUCTION_TYPE.LOAD_CONST, this.#ti(stmt), unit.id, dindex);
    } else if (stmt.value) {
      this.#emitExpr(unit, stmt.value, false);
    }
    this.#push(store_type, this.#ti(stmt), unit.id, store_operand);
  }

  #emitFunction(unit: ASTUnit, stmt: ASTNode): void {
    const ti = this.#ti(stmt);
    let dindex = this.#pushValue(unit, stmt.funcCode);
    this.#push(INSTRUCTION_TYPE.LOAD_CONST, ti, unit.id, dindex);
    dindex = this.#pushValue(unit, stmt.funcArgs);
    this.#push(INSTRUCTION_TYPE.LOAD_CONST, ti, unit.id, dindex);
    dindex = this.#pushValue(unit, stmt.funcName);
    this.#push(
      INSTRUCTION_TYPE.LOAD_CONST,
      typeof stmt.endTokenIndex === 'number' ? stmt.endTokenIndex : ti,
      unit.id,
      dindex,
    );
    this.#push(INSTRUCTION_TYPE.MAKE_FUNCTION, -1, unit.id, -1);
  }

  #emitIf(unit: ASTUnit, stmt: ASTNode): void {
    const ti = this.#ti(stmt);
    const jump_refs: Array<number> = [];
    for (const branch of stmt.branches || []) {
      this.#emitUnit(branch.check);
      const jifp_index = this.#push(INSTRUCTION_TYPE.JUMP_IF_FALSE_POP, ti, unit.id, -1);
      const body_start = this.#instrs.length;
      this.#push(INSTRUCTION_TYPE.PUSH_FRAME, ti, unit.id);
      this.#emitUnit(branch.body);
      this.#push(INSTRUCTION_TYPE.POP_FRAME, ti, unit.id);
      const body_len = this.#instrs.length - body_start;
      jump_refs.push(this.#push(INSTRUCTION_TYPE.JUMP_FORWARD, ti, unit.id, -1));
      this.#operands[jifp_index] = body_len + 1;
    }

    const else_body = stmt.elseBody;
    if (else_body) {
      const jit_index = this.#push(INSTRUCTION_TYPE.JUMP_IF_TRUE, ti, unit.id, -1);
      const else_start = this.#instrs.length;
      this.#push(INSTRUCTION_TYPE.PUSH_FRAME, ti, unit.id);
      this.#emitUnit(else_body);
      this.#push(INSTRUCTION_TYPE.POP_FRAME, ti, unit.id);
      this.#operands[jit_index] = this.#instrs.length - else_start;
    }

    for (const jump_ref of jump_refs) {
      this.#operands[jump_ref] = this.#instrs.length - jump_ref - 1;
    }
  }

  #emitFor(unit: ASTUnit, stmt: ASTNode): void {
    const ti = this.#ti(stmt);
    const for_init = stmt.init;
    const for_check = stmt.check;
    const for_iter = stmt.iter;
    const for_body = stmt.body;
    if (!for_init || !for_check || !for_iter || !for_body) {
      return;
    }
    this.#push(INSTRUCTION_TYPE.PUSH_FRAME, ti, unit.id);
    this.#emitUnit(for_init);
    const anchor_index = this.#instrs.length;
    this.#emitUnit(for_check);
    const jif_index = this.#push(INSTRUCTION_TYPE.JUMP_IF_FALSE, ti, unit.id, -1);

    const body_start = this.#instrs.length;
    this.#push(INSTRUCTION_TYPE.PUSH_FRAME, ti, unit.id);
    this.#emitUnit(for_body);
    this.#push(INSTRUCTION_TYPE.POP_FRAME, ti, unit.id);
    const body_len = this.#instrs.length - body_start;

    const iter_start = this.#instrs.length;
    this.#emitUnit(for_iter);
    const iter_len = this.#instrs.length - iter_start;

    this.#patchLoopJumps(body_start, body_len, iter_len);
    this.#operands[jif_index] = body_len + iter_len + 1;
    this.#push(INSTRUCTION_TYPE.JUMP_BACKWARD, ti, unit.id, this.#instrs.length - anchor_index);
    this.#push(INSTRUCTION_TYPE.POP_FRAME, ti, unit.id);
  }

  // for ($item in <iterable>) — desugared to the C-style pattern with unique
  // hidden loop variables (nested loops must not shadow through setLocal)
  #emitForIn(unit: ASTUnit, stmt: ASTNode): void {
    const ti = this.#ti(stmt);
    const head = stmt.unit;
    const body = stmt.body;
    const iterable = stmt.expr;
    if (!head || !body || !iterable) {
      return;
    }
    const seq = this.#forinCount++;
    const arr_index = this.#pushName(head, `__forin_arr_${seq}`);
    const idx_index = this.#pushName(head, `__forin_idx_${seq}`);
    const item_index = this.#pushName(head, stmt.name ?? null);
    const len_index = this.#pushValue(head, 'length');
    const zero_index = this.#pushValue(head, 0);
    const one_index = this.#pushValue(head, 1);
    const item_ti = typeof stmt.endTokenIndex === 'number' ? stmt.endTokenIndex : -1;

    this.#push(INSTRUCTION_TYPE.PUSH_FRAME, ti, unit.id);
    // __arr = <iterable>; __idx = 0
    this.#emitExpr(head, iterable, false);
    this.#push(INSTRUCTION_TYPE.STORE_NAME, -1, head.id, arr_index);
    this.#push(INSTRUCTION_TYPE.LOAD_CONST, -1, head.id, zero_index);
    this.#push(INSTRUCTION_TYPE.STORE_NAME, -1, head.id, idx_index);
    // check: __idx < __arr["length"]
    const anchor_index = this.#instrs.length;
    this.#push(INSTRUCTION_TYPE.LOAD_NAME, -1, head.id, idx_index);
    this.#push(INSTRUCTION_TYPE.LOAD_NAME, -1, head.id, arr_index);
    this.#push(INSTRUCTION_TYPE.LOAD_CONST, -1, head.id, len_index);
    this.#push(INSTRUCTION_TYPE.LOAD_DATA_ATTR, -1, head.id);
    this.#push(INSTRUCTION_TYPE.LESS_THAN_OPEN, -1, head.id);
    const jif_index = this.#push(INSTRUCTION_TYPE.JUMP_IF_FALSE, ti, unit.id, -1);
    // $item = __arr[__idx]
    this.#push(INSTRUCTION_TYPE.LOAD_NAME, -1, head.id, arr_index);
    this.#push(INSTRUCTION_TYPE.LOAD_NAME, -1, head.id, idx_index);
    this.#push(INSTRUCTION_TYPE.LOAD_DATA_ATTR, -1, head.id);
    this.#push(INSTRUCTION_TYPE.STORE_NAME, item_ti, head.id, item_index);
    // body
    const body_start = this.#instrs.length;
    this.#push(INSTRUCTION_TYPE.PUSH_FRAME, ti, unit.id);
    this.#emitUnit(body);
    this.#push(INSTRUCTION_TYPE.POP_FRAME, ti, unit.id);
    const body_len = this.#instrs.length - body_start;
    // iter: __idx = __idx + 1
    const iter_start = this.#instrs.length;
    this.#push(INSTRUCTION_TYPE.LOAD_NAME, -1, head.id, idx_index);
    this.#push(INSTRUCTION_TYPE.LOAD_CONST, -1, head.id, one_index);
    this.#push(INSTRUCTION_TYPE.ADD, -1, head.id);
    this.#push(INSTRUCTION_TYPE.STORE_NAME, -1, head.id, idx_index);
    const iter_len = this.#instrs.length - iter_start;

    this.#patchLoopJumps(body_start, body_len, iter_len);
    this.#push(INSTRUCTION_TYPE.JUMP_BACKWARD, ti, unit.id, this.#instrs.length - anchor_index);
    const pop_index = this.#push(INSTRUCTION_TYPE.POP_FRAME, ti, unit.id);
    this.#operands[jif_index] = pop_index - jif_index - 1;
  }

  // Patch break (-2) / continue (-1) sentinels emitted within the body.
  #patchLoopJumps(body_start: number, body_len: number, iter_len: number): void {
    for (let index = body_start; index < body_start + body_len; ++index) {
      if (this.#instrs[index] === INSTRUCTION_TYPE.JUMP_FORWARD) {
        const rel = index - body_start;
        if (this.#operands[index] === -2) {
          this.#operands[index] = body_len + iter_len - rel;
        } else if (this.#operands[index] === -1) {
          this.#operands[index] = body_len - rel - 1;
        }
      }
    }
  }

  #emitExpr(unit: ASTUnit, expr: ASTNode, silent: boolean): void {
    switch (expr.node) {
      case NODE.Missing:
        break;
      case NODE.Literal: {
        const dindex = this.#pushValue(unit, expr.literal);
        this.#push(INSTRUCTION_TYPE.LOAD_CONST, this.#ti(expr), unit.id, dindex);
        break;
      }
      case NODE.Variable: {
        const dindex = this.#pushName(unit, expr.name ?? null);
        this.#push(INSTRUCTION_TYPE.LOAD_NAME, this.#ti(expr), unit.id, dindex);
        break;
      }
      case NODE.VarCall: {
        const dindex = this.#pushName(unit, expr.name ?? null);
        this.#push(INSTRUCTION_TYPE.LOAD_NAME_CALLEABLE, this.#ti(expr), unit.id, dindex);
        this.#push(
          silent || unit.silent ? INSTRUCTION_TYPE.CALL_FUNCTION_SILENT : INSTRUCTION_TYPE.CALL_FUNCTION,
          -1,
          unit.id,
        );
        break;
      }
      case NODE.Unary:
        if (expr.expr) {
          this.#emitExpr(unit, expr.expr, silent);
        }
        this.#push(
          expr.op === LEXER.Not ? INSTRUCTION_TYPE.NOT : INSTRUCTION_TYPE.UNITARY_NEGATIVE,
          this.#ti(expr),
          unit.id,
        );
        break;
      case NODE.Binary:
        this.#emitBinary(unit, expr, silent);
        break;
      case NODE.Ternary:
        this.#emitTernary(unit, expr, silent);
        break;
      case NODE.Subscript: {
        const sub_base = expr.base;
        const sub_index = expr.index;
        if (sub_base && sub_index) {
          this.#emitExpr(unit, sub_base, silent);
          this.#emitUnit(sub_index);
          this.#push(INSTRUCTION_TYPE.LOAD_DATA_ATTR, this.#ti(expr), unit.id);
        }
        break;
      }
      case NODE.ArrayExpr:
      case NODE.DictExpr:
      case NODE.InlineUnit: {
        const expr_unit = expr.unit;
        if (expr_unit) {
          this.#emitUnit(expr_unit);
        }
        if (expr.node === NODE.ArrayExpr) {
          this.#push(INSTRUCTION_TYPE.BUILD_LIST, this.#ti(expr), unit.id, expr.itemCount ?? 0);
        } else if (expr.node === NODE.DictExpr) {
          this.#push(INSTRUCTION_TYPE.BUILD_MAP, this.#ti(expr), unit.id, expr.itemCount ?? 0);
        }
        break;
      }
      case NODE.FunctionDef:
      case NODE.AnonFunction:
        this.#emitFunction(unit, expr);
        break;
      case NODE.PostfixUpdate: {
        // Postfix ++/--: load the old value (the expression result), then
        // update the variable through STORE_NAME — its ++/-- token applies
        // compound semantics and consumes the injected constant 1.
        const upd_target = expr.target;
        if (!upd_target || upd_target.node !== NODE.Variable) {
          break;
        }
        const name_index = this.#pushName(unit, upd_target.name ?? null);
        this.#push(INSTRUCTION_TYPE.LOAD_NAME, this.#ti(upd_target), unit.id, name_index);
        const dindex = this.#pushValue(unit, 1);
        this.#push(INSTRUCTION_TYPE.LOAD_CONST, this.#ti(expr), unit.id, dindex);
        this.#push(INSTRUCTION_TYPE.STORE_NAME, this.#ti(expr), unit.id, name_index);
        break;
      }
      case NODE.PrefixUpdate: {
        // Prefix ++/--: update the variable first (STORE_NAME with the ++/--
        // token applies compound semantics, consuming the injected constant
        // 1), then load the NEW value as the expression result.
        const upd_target = expr.target;
        if (!upd_target || upd_target.node !== NODE.Variable) {
          break;
        }
        const name_index = this.#pushName(unit, upd_target.name ?? null);
        const dindex = this.#pushValue(unit, 1);
        this.#push(INSTRUCTION_TYPE.LOAD_CONST, this.#ti(expr), unit.id, dindex);
        this.#push(INSTRUCTION_TYPE.STORE_NAME, this.#ti(expr), unit.id, name_index);
        this.#push(INSTRUCTION_TYPE.LOAD_NAME, this.#ti(upd_target), unit.id, name_index);
        break;
      }
    }
  }

  // cond ? cons : alt — same JUMP_IF_FALSE_POP/JUMP_FORWARD shape as #emitIf,
  // minus the PUSH_FRAME/POP_FRAME (a pure expression needs no new scope).
  #emitTernary(unit: ASTUnit, expr: ASTNode, silent: boolean): void {
    const ti = this.#ti(expr);
    if (expr.test) {
      this.#emitExpr(unit, expr.test, silent);
    }
    const jifp_index = this.#push(INSTRUCTION_TYPE.JUMP_IF_FALSE_POP, ti, unit.id, -1);
    if (expr.consequent) {
      this.#emitExpr(unit, expr.consequent, silent);
    }
    const jf_index = this.#push(INSTRUCTION_TYPE.JUMP_FORWARD, ti, unit.id, -1);
    this.#operands[jifp_index] = this.#instrs.length - jifp_index - 1;
    if (expr.alternate) {
      this.#emitExpr(unit, expr.alternate, silent);
    }
    this.#operands[jf_index] = this.#instrs.length - jf_index - 1;
  }

  #emitBinary(unit: ASTUnit, expr: ASTNode, silent: boolean): void {
    if (expr.left) {
      this.#emitExpr(unit, expr.left, silent);
    }
    const rhs = expr.right;
    if (expr.op === LEXER.And) {
      const jump_index = this.#push(INSTRUCTION_TYPE.JUMP_IF_FALSE, this.#ti(expr), unit.id, -1);
      if (rhs) {
        this.#emitExpr(unit, rhs, silent);
      }
      this.#push(INSTRUCTION_TYPE.AND, this.#ti(expr), unit.id);
      // Skip the RHS and the AND itself: the (falsy) LHS is the result
      this.#operands[jump_index] = this.#instrs.length - jump_index - 1;
      return;
    }
    if (rhs) {
      this.#emitExpr(unit, rhs, silent);
    }
    const instr_type = BINARY_INSTR.get(expr.op ?? -1);
    if (typeof instr_type !== 'undefined') {
      this.#push(instr_type, this.#ti(expr), unit.id);
    }
  }
}
