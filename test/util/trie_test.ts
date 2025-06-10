import assert from "assert";
import { Trie } from "../../src/util/trie";

{
  const trie: Trie<string, number> = new Trie<string, number>();
  trie.insert("a", 1);
  assert.strictEqual(trie.size(), 1);
  trie.insert("ab", 2);
  assert.strictEqual(trie.size(), 2);
  trie.insert("abc", 3);
  assert.strictEqual(trie.size(), 3);

  assert.strictEqual(trie.lookup("a"), 1);
  assert.strictEqual(trie.lookup("ab"), 2);
  assert.strictEqual(trie.lookup("abc"), 3);
  assert.strictEqual(trie.lookup("z"), undefined);

  trie.remove("ab");
  assert.strictEqual(trie.size(), 2);
  assert.strictEqual(trie.lookup("ab"), undefined);
  assert.strictEqual(trie.lookup("abc"), 3);

  trie.remove("abc");
  assert.strictEqual(trie.size(), 1);
  assert.strictEqual(trie.lookup("abc"), undefined);
  assert.strictEqual(trie.lookup("a"), 1);

  trie.clear();
  assert.strictEqual(trie.size(), 0);
  assert.strictEqual(trie.lookup("a"), undefined);
  assert.strictEqual(trie.lookup("ab"), undefined);
  assert.strictEqual(trie.lookup("abc"), undefined);
}

{
  const trie: Trie<string, number> = new Trie<string, number>(
    [["a", 1], ["ab", 2], ["abc", 3]]
  );
  assert.strictEqual(trie.size(), 3);

  assert.strictEqual(trie.lookup("a"), 1);
  assert.strictEqual(trie.lookup("ab"), 2);
  assert.strictEqual(trie.lookup("abc"), 3);
  assert.strictEqual(trie.lookup("z"), undefined);

  trie.remove("ab");
  assert.strictEqual(trie.size(), 2);
  assert.strictEqual(trie.lookup("ab"), undefined);
  assert.strictEqual(trie.lookup("abc"), 3);

  trie.remove("abc");
  assert.strictEqual(trie.size(), 1);
  assert.strictEqual(trie.lookup("abc"), undefined);
  assert.strictEqual(trie.lookup("a"), 1);

  trie.clear();
  assert.strictEqual(trie.size(), 0);
  assert.strictEqual(trie.lookup("a"), undefined);
  assert.strictEqual(trie.lookup("ab"), undefined);
  assert.strictEqual(trie.lookup("abc"), undefined);
}

{
  const trie: Trie<string, number> = new Trie<string, number>();
  trie.insert("a", 1);
  trie.insert("abcdef", 2);
  trie.insert("abcdeg", 3);
  trie.insert("abcdeh", 4);
  let expectedValue = 2;
  let expectedLetter = "f";
  trie.visit("abc", (path, value) => {
    console.log(`visit ${value}`);
    assert.ok(expectedValue >= 2 && expectedValue <= 4);
    assert.strictEqual(value, expectedValue++);
    assert.strictEqual(path.join(''), "abcde" + expectedLetter);
    expectedLetter = String.fromCharCode(expectedLetter.charCodeAt(0) + 1);
    return true;
  });
  assert.strictEqual(expectedValue, 5);
  assert.strictEqual(expectedLetter, "i");

  trie.remove("abcdeg");

  expectedValue = 2;
  expectedLetter = "f";
  trie.visit("abc", (path, value) => {
    assert.ok(expectedValue >= 2 && expectedValue <= 4);
    assert.strictEqual(value, expectedValue);
    expectedValue += 2;
    assert.strictEqual(path.join(''), "abcde" + expectedLetter);
    expectedLetter = String.fromCharCode(expectedLetter.charCodeAt(0) + 2);

    return true;
  });
  assert.strictEqual(expectedValue, 6);
  assert.strictEqual(expectedLetter, "j");
}
