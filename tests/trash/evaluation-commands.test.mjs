import {makeTrash} from './support';

describe('ported OdooTerminal TraSH evaluation and command behavior', () => {
  let trash;

  beforeEach(() => {
    trash = makeTrash();
  });

  test('test_trash_runners', async () => {
    await trash.eval('$test = (search res.partner)');
    let results = await trash.eval("$test['ids']");
    expect(results.constructor).toBe(Array);
    expect(results.length).toBeGreaterThan(0);
    results = await trash.eval("(search res.partner -f name)['ids']");
    expect(results.constructor).toBe(Array);
    expect(results.length).toBeGreaterThan(0);
    results = await trash.eval("(search res.partner -f name)[0]['name']");
    expect(results.constructor).toBe(String);
    expect(results.length).toBeGreaterThan(0);
    results = await trash.eval("(search res.partner -of 1 -l 2)['ids']");
    expect(results).toEqual([2, 3]);
    results = await trash.eval('{test: (gen -mi 1 -ma 4)}');
    expect(results.test.length).toBeGreaterThan(0);
    results = await trash.eval(
      '{fulano: (gen -mi 2 -ma 4), mengano: (gen -mi 4 -ma 7), zutano: { perengano: (gen -t int -mi 7 -ma 10) }}',
    );
    expect(results.fulano.length).toBeGreaterThan(0);
    expect(results.mengano.length).toBeGreaterThan(0);
    expect(results.zutano.perengano).toBeGreaterThan(6);
  });

  test('test_trash_functions', async () => {
    let results = await trash.eval('function mop(a,  b  )  { $c = $b - $a  ; return    $c }; mop 10 2');
    expect(results).toBe(-8);
    results = await trash.eval('$mop = function (   a,    b  )  { $c = $b - $a  ; return    $c  }; $$mop 10 2');
    expect(results).toBe(-8);
    results = await trash.eval(
      "$mop = function (   a,    b  )  { $c = $b - $a  ; return    $c  }; silent print '42' + ($$mop 10 2)",
    );
    expect(results.substr(0, 2)).toBe('42');
    expect(results.substr(2)).toBe('-8');
    results = await trash.eval('$mop = function ()  { return (gen -mi 4 -ma 7) }; $$mop');
    expect(results.length).toBeGreaterThan(0);
    results = await trash.eval("$mop = function ()  { return (gen -mi 4 -ma 7) }; silent print '42' + $$mop");
    expect(results.length).toBeGreaterThan(2);
    expect(results.substr(0, 2)).toBe('42');
    const code = `
      $nums = [1, 2, 3]
      $nums = (arr_map $nums (function (item) { return $item * 2 }))
      $nums = (arr_filter $nums (function (item) { return $item != 4 }))
      arr_reduce $nums 0 (function (a, b) { return $a + $b })
    `;
    results = await trash.eval(code);
    expect(results).toBe(8);
    const code2 = `
      $sq = function (x) { return ($x * $x) }
      arr_map [1, 2, 3, 4, 5] $$sq
    `;
    results = await trash.eval(code2);
    expect(results[0]).toBe(1);
    expect(results[1]).toBe(4);
    expect(results[2]).toBe(9);
    expect(results[3]).toBe(16);
    expect(results[4]).toBe(25);
  });

  test('test_trash_mix', async () => {
    let results = await trash.eval("$data = {numA: 4, numB:9}; ['te'+ 'st' + '!', $data['numA'], 42]");
    expect(results[0]).toBe('test!');
    expect(results[1]).toBe(4);
    expect(results[2]).toBe(42);
    results = await trash.eval(
      "$data = {numA: 4, numB:9}; {'key' + 'A' + '001' + 'K' + 'Z': $data['numA'], (print 'Test Runner') + '_o': 'Val:' + $data['numB'] + '-E', 'key' + $data['numB']: 42}",
    );
    expect(results.keyA001KZ).toBe(4);
    expect(results['Test Runner_o']).toBe('Val:9-E');
    expect(results.key9).toBe(42);

    let code = `
      function getPartnerCompanies() {
        $res = []
        $partners = (search res.partner -f is_company)
        for ($i = 0; $i < $partners['length']; $i += 1) {
          $partner = $partners[$i]
          if ($partner['is_company']) {
            arr_append $res $partner
          }
        }
        return $res
      }
      getPartnerCompanies
    `;
    results = await trash.eval(code);
    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBeGreaterThan(0);

    code = `
      $arr = []
      for ($i = 0; $i < 100; $i += 1) {
        if ($i % 2 == 0) {
          continue
        }
        arr_append $arr $i
      }
      $arr
    `;
    results = await trash.eval(code);
    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBe(50);

    code = `
      $arr = []
      for ($i = 0; $i < 100; $i += 1) {
        if ($i >= 10) {
          break
        }
        arr_append $arr $i
      }
      $arr
    `;
    results = await trash.eval(code);
    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBe(10);

    code = `
      $arr = false
      if ($arr && $arr['test']) {
        return 'a'
      }
      return 'b'
    `;
    results = await trash.eval(code);
    expect(results).toBe('b');

    code = `
      $arr = false
      $val = true
      if ($arr && $arr['test'] || $val) {
        return 'a'
      }
      return 'b'
    `;
    results = await trash.eval(code);
    expect(results).toBe('a');

    code = `
      function test_paramsA(paramA: Number, paramB: String, paramC: Number = 42) {
        return $paramC;
      }
      test_paramsA 10 'dummy'
    `;
    results = await trash.eval(code);
    expect(results).toBe(42);

    code = `
      function test_paramsB(paramA: Number, paramB: String, paramC: Number = 42) {
        return $paramC;
      }
      test_paramsB 10 'dummy' 74
    `;
    results = await trash.eval(code);
    expect(results).toBe(74);

    code = `
      function test_paramsC(paramA: Number, paramB: String, paramC: String = '42') {
        return $paramC;
      }
      test_paramsC 10 'dummy'
    `;
    results = await trash.eval(code);
    expect(results).toBe('42');

    code = `
      $var_test = '32'
      function test_paramsD(paramA: Number, paramB: String, paramC: String = $var_test) {
        return $paramC;
      }
      test_paramsD 10 'dummy'
    `;
    results = await trash.eval(code);
    expect(results).toBe('32');
    code = `
      $var_test = '72'
      test_paramsD 10 'dummy'
    `;
    results = await trash.eval(code);
    expect(results).toBe('72');

    code = `
      $var_test = 3;
      if ($var_test == 2) {
        return "A"
      } elif ($var_test == 3) {
        return "B"
      }
    `;
    results = await trash.eval(code);
    expect(results).toBe('B');
    code = `
      $var_test = 2;
      if ($var_test == 2) {
        return "A"
      } elif ($var_test == 3) {
        return "B"
      }
    `;
    results = await trash.eval(code);
    expect(results).toBe('A');
    code = `
      $var_test = 6;
      if ($var_test == 2) {
        return "A"
      } elif ($var_test == 3) {
        return "B"
      } else {
        return "C"
      }
    `;
    results = await trash.eval(code);
    expect(results).toBe('C');
    code = `
      $var_test = 6;
      if ($var_test == 2) {
        return "A"
      } elif ($var_test == 3) {
        return "B"
      }
      return "D"
    `;
    results = await trash.eval(code);
    expect(results).toBe('D');

    code = `
      $var_test = 0;
      for ($i = 0; $i < 2; $i += 1) {
        for ($e = 0; $e < 10; $e += 1) {
          if ($e == 5) {
            break
          }
          $var_test += 1
        }
        $var_test += 1
      }
      return $var_test
    `;
    results = await trash.eval(code);
    expect(results).toBe(12);
  });
});
