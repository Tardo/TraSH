import {makeTrash} from './support';

describe('ported OdooTerminal TraSH standard-library behavior', () => {
  let trash;

  beforeEach(() => {
    trash = makeTrash();
  });

  test('test_trash_str_funcs', async () => {
    let results = await trash.eval("str_split -s 'hello,world' -d ','");
    expect(results[0]).toBe('hello');
    expect(results[1]).toBe('world');
    results = await trash.eval("str_split -s 'a,b,c' -d ','");
    expect(results.length).toBe(3);
    expect(results[1]).toBe('b');
    results = await trash.eval("str_upper -s 'hello'");
    expect(results).toBe('HELLO');
    results = await trash.eval("str_upper -s 'Hello World'");
    expect(results).toBe('HELLO WORLD');
    results = await trash.eval("str_lower -s 'HELLO WORLD'");
    expect(results).toBe('hello world');
    results = await trash.eval("str_lower -s 'Hello'");
    expect(results).toBe('hello');
    results = await trash.eval("str_trim -s '  hello  '");
    expect(results).toBe('hello');
    results = await trash.eval("str_trim -s 'no spaces'");
    expect(results).toBe('no spaces');
    results = await trash.eval("str_replace -s 'hello world' -f 'o' -r '0'");
    expect(results).toBe('hell0 world');
    results = await trash.eval("str_replace -s 'hello world' -f 'o' -r '0' -a");
    expect(results).toBe('hell0 w0rld');
    results = await trash.eval("str_slice -s 'hello world' -b 6");
    expect(results).toBe('world');
    results = await trash.eval("str_slice -s 'hello world' -b 0 -e 5");
    expect(results).toBe('hello');
    results = await trash.eval("str_slice -s 'hello world' -b 3 -e 8");
    expect(results).toBe('lo wo');
    results = await trash.eval("str_includes -s 'hello world' -n 'world'");
    expect(results).toBe(true);
    results = await trash.eval("str_includes -s 'hello world' -n 'xyz'");
    expect(results).toBe(false);
    results = await trash.eval("str_starts -s 'hello world' -p 'hello'");
    expect(results).toBe(true);
    results = await trash.eval("str_starts -s 'hello world' -p 'world'");
    expect(results).toBe(false);
    results = await trash.eval("str_ends -s 'hello world' -u 'world'");
    expect(results).toBe(true);
    results = await trash.eval("str_ends -s 'hello world' -u 'hello'");
    expect(results).toBe(false);
  });

  test('test_trash_math_funcs', async () => {
    let results = await trash.eval('floor -n 3.7');
    expect(results).toBe(3);
    results = await trash.eval('floor -n 3.0');
    expect(results).toBe(3);
    results = await trash.eval('fixed -n 3.7 -d 0');
    expect(results).toBe(4);
    results = await trash.eval('fixed -n 3.2 -d 0');
    expect(results).toBe(3);
    results = await trash.eval('rand -mi 5 -ma 10');
    expect(results >= 5 && results <= 10).toBe(true);
    results = await trash.eval('rand -mi 42 -ma 42');
    expect(results).toBe(42);
    results = await trash.eval('abs -n 5');
    expect(results).toBe(5);
    results = await trash.eval('abs -n 0');
    expect(results).toBe(0);
    results = await trash.eval('pow -b 2 -e 5');
    expect(results).toBe(32);
    results = await trash.eval('pow -b 3 -e 3');
    expect(results).toBe(27);
    results = await trash.eval('pow -b 5 -e 0');
    expect(results).toBe(1);
  });

  test('test_trash_ende_funcs', async () => {
    let results = await trash.eval("encode -v 'hello' -m b64");
    expect(results).toBe('aGVsbG8=');
    results = await trash.eval("decode -v 'aGVsbG8=' -m b64");
    expect(results).toBe('hello');
    results = await trash.eval("decode -v (encode -v 'test string' -m b64) -m b64");
    expect(results).toBe('test string');
  });

  test('test_trash_time_funcs', async () => {
    const ts = await trash.eval('pnow');
    expect(typeof ts === 'number' && ts > 0).toBe(true);
    await trash.eval('sleep -t 50');
  });

  test('test_trash_array_stdlib', async () => {
    let results = await trash.eval('$ac = [1, 2, 3]; $bc = (arr_clone $ac); $bc');
    expect(results[0]).toBe(1);
    expect(results[1]).toBe(2);
    expect(results[2]).toBe(3);
    results = await trash.eval('arr_append $bc 99; $ac');
    expect(results.length).toBe(3);
    results = await trash.eval('$ap = [2, 3]; arr_prepend $ap 1; $ap');
    expect(results[0]).toBe(1);
    expect(results[1]).toBe(2);
    expect(results[2]).toBe(3);
    expect(results.length).toBe(3);
    results = await trash.eval('$ape = []; arr_prepend $ape 42; $ape');
    expect(results[0]).toBe(42);
    expect(results.length).toBe(1);
    results = await trash.eval("arr_join [1, 2, 3] ','");
    expect(results).toBe('1,2,3');
    results = await trash.eval("arr_join ['a', 'b', 'c'] '|'");
    expect(results).toBe('a|b|c');
    results = await trash.eval("arr_join ['x', 'y', 'z']");
    expect(results).toBe('xyz');
  });

  test('test_trash_dict_funcs', async () => {
    let results = await trash.eval('dict_keys {a: 1, b: 2}');
    expect(results.length).toBe(2);
    expect(results.includes('a')).toBe(true);
    expect(results.includes('b')).toBe(true);
    results = await trash.eval('dict_values {a: 1, b: 2}');
    expect(results.length).toBe(2);
    expect(results.includes(1)).toBe(true);
    expect(results.includes(2)).toBe(true);
    results = await trash.eval('dict_entries {a: 1, b: 2}');
    expect(results.length).toBe(2);
    const entries = Object.fromEntries(results);
    expect(entries.a).toBe(1);
    expect(entries.b).toBe(2);
    results = await trash.eval("dict_has {a: 1} 'a'");
    expect(results).toBe(true);
    results = await trash.eval("dict_has {a: 1} 'b'");
    expect(results).toBe(false);
    results = await trash.eval("dict_get {a: 1} 'a'");
    expect(results).toBe(1);
    results = await trash.eval("dict_get {a: 1} 'b' 99");
    expect(results).toBe(99);
    results = await trash.eval("$d = {a: 1}; dict_set $d 'b' 2; $d");
    expect(results.a).toBe(1);
    expect(results.b).toBe(2);
    results = await trash.eval("$d = {a: 1, b: 2}; dict_remove $d 'a'; $d");
    expect(results).not.toHaveProperty('a');
    expect(results.b).toBe(2);
    results = await trash.eval('$d1 = {a: 1}; $d2 = {b: 2}; $merged = (dict_merge $d1 $d2); [$merged, $d1, $d2]');
    expect(results[0].a).toBe(1);
    expect(results[0].b).toBe(2);
    expect(results[1]).not.toHaveProperty('b');
    expect(results[2]).not.toHaveProperty('a');
    results = await trash.eval("$d = {a: 1}; $c = (dict_clone $d); dict_set $c 'b' 2; [$d, $c]");
    expect(results[0]).not.toHaveProperty('b');
    expect(results[1].a).toBe(1);
    expect(results[1].b).toBe(2);
    results = await trash.eval('dict_size {a: 1, b: 2, c: 3}');
    expect(results).toBe(3);
    results = await trash.eval('dict_size {}');
    expect(results).toBe(0);
  });
});
