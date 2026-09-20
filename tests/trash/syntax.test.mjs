import {makeTrash} from './support';

describe('ported OdooTerminal TraSH syntax behavior', () => {
  let trash;

  beforeEach(() => {
    trash = makeTrash();
  });

  test('test_trash_escape_sequences', async () => {
    let results = await trash.eval(String.raw`"say \"hi\""`);
    expect(results).toBe('say "hi"');
    results = await trash.eval(String.raw`'it\'s working'`);
    expect(results).toBe("it's working");
    results = await trash.eval(String.raw`"a\\"`);
    expect(results).toBe('a\\');
    results = await trash.eval(String.raw`"line1\nline2"`);
    expect(results).toBe('line1\nline2');
    results = await trash.eval(String.raw`"C:\Users"`);
    expect(results).toBe('C:\\Users');
  });

  test('test_trash_array', async () => {
    let results = await trash.eval('[1,    2    , 3,     4     ]');
    expect(results[0]).toBe(1);
    expect(results[1]).toBe(2);
    expect(results[2]).toBe(3);
    expect(results[3]).toBe(4);
    results = await trash.eval("[  'test', 'this','lalala lo,lolo']");
    expect(results[0]).toBe('test');
    expect(results[1]).toBe('this');
    expect(results[2]).toBe('lalala lo,lolo');
    results = await trash.eval('[  23,        -2,3,-345]');
    expect(results[0]).toBe(23);
    expect(results[1]).toBe(-2);
    expect(results[2]).toBe(3);
    expect(results[3]).toBe(-345);
    results = await trash.eval(
      "[[ 1, 2, 3 ,4], ['test', 'this','lalala lo,  lolo', [12,   3,    [123   ,'oops'   , 123 * 2 + 4 - 2 + 6 / 2, {   key: 'the value'}]]]]",
    );
    expect(results[0][0]).toBe(1);
    expect(results[0][1]).toBe(2);
    expect(results[0][2]).toBe(3);
    expect(results[0][3]).toBe(4);
    expect(results[1][0]).toBe('test');
    expect(results[1][1]).toBe('this');
    expect(results[1][2]).toBe('lalala lo,  lolo');
    expect(results[1][3][0]).toBe(12);
    expect(results[1][3][1]).toBe(3);
    expect(results[1][3][2][0]).toBe(123);
    expect(results[1][3][2][1]).toBe('oops');
    expect(results[1][3][2][2]).toBe(251);
    expect(results[1][3][2][3].key).toBe('the value');
    results = await trash.eval("$var = []; $var[0] = 'value'; $var");
    expect(results[0]).toBe('value');
  });

  test('test_trash_dictionary', async () => {
    let results = await trash.eval("{keyA: 'the value', keyB: 'the, value'}");
    expect(results.keyA).toBe('the value');
    expect(results.keyB).toBe('the, value');
    results = await trash.eval("{keyA: -23, keyB: 'the, value'}");
    expect(results.keyA).toBe(-23);
    expect(results.keyB).toBe('the, value');
    results = await trash.eval('{keyA: 1234, keyB: 55}');
    expect(results.keyA).toBe(1234);
    expect(results.keyB).toBe(55);
    results = await trash.eval(
      "{keyA: 1234, keyB: 'the value', keyC: 'the, value', keyD: {keyA: 23, keyB: [2,33,4], keyC: {keyA   :   'the, value'}}}",
    );
    expect(results.keyA).toBe(1234);
    expect(results.keyB).toBe('the value');
    expect(results.keyC).toBe('the, value');
    expect(results.keyD.keyA).toBe(23);
    expect(results.keyD.keyB[0]).toBe(2);
    expect(results.keyD.keyB[1]).toBe(33);
    expect(results.keyD.keyB[2]).toBe(4);
    expect(results.keyD.keyC.keyA).toBe('the, value');
    results = await trash.eval("$var = {}; $var['key'] = 'value'");
    expect(results.key).toBe('value');
  });

  test('test_trash_undefined', async () => {
    let results = await trash.eval("$d = {a: 1}; $d['nope']");
    expect(results).toBeUndefined();
    results = await trash.eval('$arr = [1, 2]; $arr[10]');
    expect(results).toBeUndefined();
    results = await trash.eval('undefined');
    expect(results).toBeUndefined();
    results = await trash.eval("$d = {a: 1}; $d['nope'] == undefined");
    expect(results).toBe(true);
    results = await trash.eval("$d = {a: 1}; $d['nope'] == null");
    expect(results).toBe(false);
    results = await trash.eval("$d = {a: null}; $d['a'] == null");
    expect(results).toBe(true);
    results = await trash.eval("$d = {}; $x = $d['nope']; $x == undefined");
    expect(results).toBe(true);
    results = await trash.eval("$d = {}; if ($d['flag']) { return 'a' }; return 'b'");
    expect(results).toBe('b');
  });

  test('test_trash_assigments', async () => {
    let results = await trash.eval('$var_at = 2; $var_at += 5; $var_at -= 1; $var_at *= 2; $var_at /= 2; $var_at');
    expect(results).toBe(6);
    results = await trash.eval(
      '$arr_at = [1, [34, [2, 10], 4]]; $arr_at[1][1][0] += 5; $arr_at[1][1][0] -= 1; $arr_at[1][1][0] *= 2; $arr_at[1][1][0] /= 2; $arr_at;',
    );
    expect(results[1][1][0]).toBe(6);
    results = await trash.eval('$var_at_t = 5; $var_at = 2; $var_at += $var_at_t; $var_at');
    expect(results).toBe(7);
    results = await trash.eval(
      '$arr_at_t = [1, [34, [2, 10], 4]]; $var_at = 2; $var_at += $arr_at_t[1][1][1]; $var_at',
    );
    expect(results).toBe(12);
  });

  test('test_trash_variables', async () => {
    await trash.eval("$test = 'this is a test'");
    let results = await trash.eval('$test');
    expect(results).toBe('this is a test');
    await trash.eval('$test = 1234');
    results = await trash.eval('$test');
    expect(results).toBe(1234);
    await trash.eval('$test = [1,2,3,4]');
    results = await trash.eval('$test');
    expect(results[2]).toBe(3);
    await trash.eval('$test[2] = 42');
    results = await trash.eval('$test');
    expect(results[2]).toBe(42);
    await trash.eval("$test = {test: 12, this: 'is trash'}");
    results = await trash.eval('$test');
    expect(results.test).toBe(12);
    await trash.eval(`$test['this'] = "blabla'bla; 'a'nd, bla"`);
    results = await trash.eval('$test');
    expect(results.this).toBe("blabla'bla; 'a'nd, bla");
  });

  test('test_trash_concat', async () => {
    let results = await trash.eval("$a = 'blabla'; $b = 1234;$a+'---' + $b;");
    expect(results).toBe('blabla---1234');
    results = await trash.eval("$a = 'blabla'\n $b = 1234\n$a+'---' + $b;");
    expect(results).toBe('blabla---1234');
    results = await trash.eval(
      "$a = [{test: 124, this: 'lelele lololo'}]; $b = [54,42]; $a[0]['this'] + '---' + $b[1];",
    );
    expect(results).toBe('lelele lololo---42');
    results = await trash.eval("'VAT: ' + false");
    expect(results).toBe('VAT: false');
  });

  test('test_trash_arithmetic', async () => {
    let results = await trash.eval('(((5+5)*2))');
    expect(results).toBe(20);
    results = await trash.eval('$val = 5*2; 5+$val');
    expect(results).toBe(15);
    results = await trash.eval('$val = 5*2; 5+$val-55*(45-33)');
    expect(results).toBe(-645);
    results = await trash.eval(
      "$data = {numA: 4, numB:9, numC: [23,2]}; ($data['numA']    * $data['numB'] + $data['numC'][1] +    4  )  * -2   ",
    );
    expect(results).toBe(-84);
    results = await trash.eval('$a = [1,2]; $b = 3; $a[0] * -$b');
    expect(results).toBe(-3);
    results = await trash.eval("$obj = {x: -4}; $arr = [2]; $arr[0] * -$obj['x']");
    expect(results).toBe(8);
    results = await trash.eval('$n = -2; 1 - -$n');
    expect(results).toBe(-1);
    results = await trash.eval('$a = 2; $b = 3; $c = 4; $a + $b * -$c');
    expect(results).toBe(-10);
  });

  test('test_trash_logic', async () => {
    let results = await trash.eval("$data = {numA: 4, numB:9}; $data['numB'] > 3");
    expect(results).toBe(true);
    results = await trash.eval("$data = {numA: 4, numB:9}; $data['numB'] > 13");
    expect(results).toBe(false);
    results = await trash.eval("$data = {numA: 4, numB:9}; $data['numB'] > 0 && $data['numB'] < 9");
    expect(results).toBe(false);
    results = await trash.eval("$data = {numA: 4, numB:9}; $data['numB'] >= 0 && $data['numB'] <= 9");
    expect(results).toBe(true);
    results = await trash.eval(
      "$data = {numA: 4, numB:9}; ($data['numB'] > 0 && $data['numB'] < 9) || $data['numA'] >= 4",
    );
    expect(results).toBe(true);
  });

  test('test_trash_ternary', async () => {
    let results = await trash.eval('true ? 1 : 2');
    expect(results).toBe(1);
    results = await trash.eval('false ? 1 : 2');
    expect(results).toBe(2);
    results = await trash.eval('$a = 1; $a + 1 == 2 ? "yes" : "no"');
    expect(results).toBe('yes');
    results = await trash.eval('$n = 2; $n == 1 ? "one" : $n == 2 ? "two" : "other"');
    expect(results).toBe('two');
    results = await trash.eval('$hit = 0; $r = true ? 1 : ($hit = 1); $hit');
    expect(results).toBe(0);
    results = await trash.eval('$a = 5; [$a > 0 ? "pos" : "neg", 2]');
    expect(results[0]).toBe('pos');
    results = await trash.eval("$a = 5; {v: $a > 0 ? 'pos' : 'neg'}");
    expect(results.v).toBe('pos');
    results = await trash.eval('$arr = [10, 20]; $arr[true ? 0 : 1]');
    expect(results).toBe(10);
    results = await trash.eval('(true ? false : true) ? 1 : 2');
    expect(results).toBe(2);
  });
});
