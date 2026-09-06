import {makeTrash} from './support';

describe('ported OdooTerminal TraSH control-flow behavior', () => {
  let trash;

  beforeEach(() => {
    trash = makeTrash();
  });

  test('test_trash_increment_decrement', async () => {
    let results = await trash.eval('$n = 5; $n++; $n');
    expect(results).toBe(6);
    results = await trash.eval('$n = 5; $n--; $n');
    expect(results).toBe(4);
    results = await trash.eval('$n = 0; $n++; $n++; $n++; $n');
    expect(results).toBe(3);
    results = await trash.eval("$buff = ''; for ($i = 0; $i < 10; $i++) { $buff = $buff + 'A' }; $buff");
    expect(results.length).toBe(10);
    results = await trash.eval('$c = 0; for ($i = 5; $i > 0; $i--) { $c += 1 }; $c');
    expect(results).toBe(5);
    results = await trash.eval('$arr = [1, 2]; $arr[0]++; $arr[1]--; $arr');
    expect(results[0]).toBe(2);
    expect(results[1]).toBe(1);
    results = await trash.eval('$obj = {a: 10}; $obj["a"]++; $obj["a"]');
    expect(results).toBe(11);
    results = await trash.eval("str_replace -s 'hello world' -f 'o' -r '0' --all");
    expect(results).toBe('hell0 w0rld');
    results = await trash.eval('$i = 5; $a = $i++; [$a, $i]');
    expect(results[0]).toBe(5);
    expect(results[1]).toBe(6);
    results = await trash.eval('$i = 5; $a = ($i--); [$a, $i]');
    expect(results[0]).toBe(5);
    expect(results[1]).toBe(4);
    results = await trash.eval('$i = 5; $a = 1 + $i++; [$a, $i]');
    expect(results[0]).toBe(6);
    expect(results[1]).toBe(6);
    results = await trash.eval('$n = 5; $n++; $n');
    expect(results).toBe(6);
    results = await trash.eval('$n = 5; ++$n; $n');
    expect(results).toBe(6);
    results = await trash.eval('$n = 5; --$n; $n');
    expect(results).toBe(4);
    results = await trash.eval('$arr = [1, 2]; ++$arr[0]; --$arr[1]; $arr');
    expect(results[0]).toBe(2);
    expect(results[1]).toBe(1);
    results = await trash.eval('$i = 5; $a = ++$i; [$a, $i]');
    expect(results[0]).toBe(6);
    expect(results[1]).toBe(6);
    results = await trash.eval('$i = 5; $a = --$i; [$a, $i]');
    expect(results[0]).toBe(4);
    expect(results[1]).toBe(4);
    results = await trash.eval('$i = 5; $a = 1 + ++$i; [$a, $i]');
    expect(results[0]).toBe(7);
    expect(results[1]).toBe(6);
    results = await trash.eval("$buff = ''; for ($i = 0; $i < 10; ++$i) { $buff = $buff + 'A' }; $buff['length']");
    expect(results).toBe(10);
    results = await trash.eval('$n = 10\nfor ($i = 0; $i < 3; $i++) {\n  --$n\n}\n$n');
    expect(results).toBe(7);
  });

  test('test_trash_forin', async () => {
    let results = await trash.eval('$sum = 0; for ($x in [1, 2, 3, 4]) { $sum += $x }; $sum');
    expect(results).toBe(10);
    results = await trash.eval(
      "$names = ''; $items = [{n: 'a'}, {n: 'b'}]; for ($it in $items) { $names = $names + $it['n'] }; $names",
    );
    expect(results).toBe('ab');
    results = await trash.eval('$t = 0; for ($a in [1, 2]) { for ($b in [10, 20]) { $t += $a * $b } }; $t');
    expect(results).toBe(90);
    results = await trash.eval('$c = 0; for ($x in [1, 2, 3, 4, 5]) { if ($x == 4) { break }; $c += 1 }; $c');
    expect(results).toBe(3);
    results = await trash.eval('$c = 0; for ($x in [1, 2, 3, 4, 5]) { if ($x % 2 == 0) { continue }; $c += $x }; $c');
    expect(results).toBe(9);
    results = await trash.eval('$c = 0; for ($p in (search res.partner -f id -l 3)) { $c += 1 }; $c');
    expect(results).toBe(3);
    results = await trash.eval("$r = ''; for ($ch in 'abc') { $r = $ch + $r }; $r");
    expect(results).toBe('cba');
  });

  test('test_trash_if', async () => {
    let results = await trash.eval(
      '$num = (gen int -mi 0 -ma 10); if (($num + 10) < 5) { return 66 } else { return 42 }',
    );
    expect(results).toBe(42);
    results = await trash.eval(
      '$num = (gen int -mi 0 -ma 10); if ($num <= 10) { $num = $num + 10; if ($num >= 10) { return 42 }; return 66; } else { return 120 }',
    );
    expect(results).toBe(42);
  });

  test('test_trash_loop', async () => {
    const results = await trash.eval("$buff = ''; for ($i = 0; $i < 100; $i += 1) { $buff = $buff + 'A'; }; $buff");
    expect(results.length === 100).toBe(true);
  });
});
