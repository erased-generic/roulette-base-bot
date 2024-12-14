import { Anagrams } from '../../src/util/anagrams';
import * as assert from 'assert';

class AnagramsTest extends Anagrams {
  guessAnagram(player: string, args: string[]) {
    const result = super.guessAnagram(player, [''].concat(args));
    delete result.describe;
    return result;
  }
}

// basic test
{
  let counter = 0;
  const anagrams = {'red': ['dre', 'der'], 'ab': ['ba'], 'dont': ['use', 'this'], 'dre': ['red'], 'ba': ['ab']};
  function randomizer() {
    if (counter == 0) {
      counter++;
      return Object.keys(anagrams).indexOf('red') / Object.keys(anagrams).length;
    } else {
      return Object.keys(anagrams).indexOf('ab') / Object.keys(anagrams).length;
    }
  }
  let instance = new AnagramsTest(['player1', 'player2'], 2, anagrams, randomizer);
  assert.strictEqual(instance.init(), undefined);
  assert.strictEqual(instance.isCurrentPlayer('player1'), true);
  assert.strictEqual(instance.isCurrentPlayer('player2'), true);
  assert.deepStrictEqual(instance.unguessed, ['red', 'ab']);
  assert.deepStrictEqual(instance.guessAnagram('player1', ['red']), { words: [], score: 0, result: undefined });
  assert.deepStrictEqual(instance.guessAnagram('player1', ['aaa']), { words: [], score: 0, result: undefined });
  assert.deepStrictEqual(instance.guessAnagram('player1', ['dre']), { words: ['red'], score: 1, result: undefined });
  assert.deepStrictEqual(instance.guessAnagram('player2', ['dre']), { words: [], score: 0, result: undefined });
  assert.deepStrictEqual(instance.guessAnagram('player2', ['ba']), { words: ['ab'], score: 1, result: { ranking: [['player1', 'player2']] } });
}

// test winning
{
  let counter = 0;
  const anagrams = {'red': ['dre', 'der'], 'ab': ['ba'], 'dont': ['use', 'this'], 'dre': ['red'], 'ba': ['ab']};
  function randomizer() {
    if (counter == 0) {
      counter++;
      return Object.keys(anagrams).indexOf('red') / Object.keys(anagrams).length;
    } else {
      return Object.keys(anagrams).indexOf('ab') / Object.keys(anagrams).length;
    }
  }
  let instance = new AnagramsTest(['player1', 'player2'], 2, anagrams, randomizer);
  assert.strictEqual(instance.init(), undefined);
  assert.strictEqual(instance.isCurrentPlayer('player1'), true);
  assert.strictEqual(instance.isCurrentPlayer('player2'), true);
  assert.deepStrictEqual(instance.unguessed, ['red', 'ab']);
  assert.deepStrictEqual(instance.guessAnagram('player1', ['red']), { words: [], score: 0, result: undefined });
  assert.deepStrictEqual(instance.guessAnagram('player2', ['aaa']), { words: [], score: 0, result: undefined });
  assert.deepStrictEqual(instance.guessAnagram('player1', ['dre']), { words: ['red'], score: 1, result: undefined });
  assert.deepStrictEqual(instance.guessAnagram('player2', ['dre']), { words: [], score: 0, result: undefined });
  assert.deepStrictEqual(instance.guessAnagram('player1', ['ba']), { words: ['ab'], score: 2, result: { ranking: [['player1'], ['player2']] } });
}

// test double anagram
{
  let counter = 0;
  const anagrams = {'red': ['dre', 'der'], 'ab': ['ba'], 'der': ['red', 'dre'], 'dre': ['red', 'der'], 'ba': ['ab']};
  function randomizer() {
    if (counter == 0) {
      counter++;
      return Object.keys(anagrams).indexOf('red') / Object.keys(anagrams).length;
    } else if (counter == 1) {
      counter++;
      return Object.keys(anagrams).indexOf('ab') / Object.keys(anagrams).length;
    } else {
      return Object.keys(anagrams).indexOf('der') / Object.keys(anagrams).length;
    }
  }
  let instance = new AnagramsTest(['player1', 'player2', 'player3'], 3, anagrams, randomizer);
  assert.strictEqual(instance.init(), undefined);
  assert.strictEqual(instance.isCurrentPlayer('player1'), true);
  assert.strictEqual(instance.isCurrentPlayer('player2'), true);
  assert.strictEqual(instance.isCurrentPlayer('player3'), true);
  assert.deepStrictEqual(instance.unguessed, ['red', 'ab', 'der']);
  assert.deepStrictEqual(instance.guessAnagram('player2', ['aaa']), { words: [], score: 0, result: undefined });
  assert.deepStrictEqual(instance.guessAnagram('player1', ['dre']), { words: ['red', 'der'], score: 2, result: undefined });
  assert.deepStrictEqual(instance.guessAnagram('player1', ['dre']), { words: [], score: 2, result: undefined });
  assert.deepStrictEqual(instance.guessAnagram('player2', ['dre']), { words: [], score: 0, result: undefined });
  assert.deepStrictEqual(instance.guessAnagram('player3', ['dre']), { words: [], score: 0, result: undefined });
  assert.deepStrictEqual(instance.guessAnagram('player1', ['red']), { words: [], score: 2, result: undefined });
  assert.deepStrictEqual(instance.guessAnagram('player2', ['red']), { words: [], score: 0, result: undefined });
  assert.deepStrictEqual(instance.guessAnagram('player3', ['red']), { words: [], score: 0, result: undefined });
  assert.deepStrictEqual(instance.guessAnagram('player1', ['der']), { words: [], score: 2, result: undefined });
  assert.deepStrictEqual(instance.guessAnagram('player2', ['der']), { words: [], score: 0, result: undefined });
  assert.deepStrictEqual(instance.guessAnagram('player3', ['der']), { words: [], score: 0, result: undefined });
  assert.deepStrictEqual(instance.guessAnagram('player3', ['ba']), { words: ['ab'], score: 1, result: { ranking: [['player1'], ['player3'], ['player2']] } });
}

// test double anagram single guess
{
  let counter = 0;
  const anagrams = {'red': ['dre', 'der'], 'ab': ['ba'], 'der': ['red', 'dre'], 'dre': ['red', 'der'], 'ba': ['ab']};
  function randomizer() {
    if (counter == 0) {
      counter++;
      return Object.keys(anagrams).indexOf('red') / Object.keys(anagrams).length;
    } else if (counter == 1) {
      counter++;
      return Object.keys(anagrams).indexOf('ab') / Object.keys(anagrams).length;
    } else {
      return Object.keys(anagrams).indexOf('der') / Object.keys(anagrams).length;
    }
  }
  let instance = new AnagramsTest(['player1', 'player2', 'player3'], 3, anagrams, randomizer);
  assert.strictEqual(instance.init(), undefined);
  assert.strictEqual(instance.isCurrentPlayer('player1'), true);
  assert.strictEqual(instance.isCurrentPlayer('player2'), true);
  assert.strictEqual(instance.isCurrentPlayer('player3'), true);
  assert.deepStrictEqual(instance.unguessed, ['red', 'ab', 'der']);
  assert.deepStrictEqual(instance.guessAnagram('player2', ['aaa']), { words: [], score: 0, result: undefined });
  assert.deepStrictEqual(instance.guessAnagram('player1', ['red']), { words: ['der'], score: 1, result: undefined });
  assert.deepStrictEqual(instance.guessAnagram('player2', ['der']), { words: ['red'], score: 1, result: undefined });
  assert.deepStrictEqual(instance.guessAnagram('player1', ['ba']), { words: ['ab'], score: 2, result: { ranking: [['player1'], ['player2'], ['player3']] } });
}

// test early finish
{
  let counter = 0;
  const anagrams = {'red': ['dre', 'der'], 'ab': ['ba'], 'der': ['red', 'dre'], 'dre': ['red', 'der'], 'ba': ['ab']};
  function randomizer() {
    if (counter == 0) {
      counter++;
      return Object.keys(anagrams).indexOf('red') / Object.keys(anagrams).length;
    } else if (counter == 1) {
      counter++;
      return Object.keys(anagrams).indexOf('ab') / Object.keys(anagrams).length;
    } else {
      return Object.keys(anagrams).indexOf('der') / Object.keys(anagrams).length;
    }
  }
  let instance = new AnagramsTest(['player1', 'player2'], 3, anagrams, randomizer);
  assert.strictEqual(instance.init(), undefined);
  assert.strictEqual(instance.isCurrentPlayer('player1'), true);
  assert.strictEqual(instance.isCurrentPlayer('player2'), true);
  assert.strictEqual(instance.isCurrentPlayer('player3'), true);
  assert.deepStrictEqual(instance.unguessed, ['red', 'ab', 'der']);
  assert.deepStrictEqual(instance.guessAnagram('player2', ['aaa']), { words: [], score: 0, result: undefined });
  assert.deepStrictEqual(instance.guessAnagram('player1', ['dre']), { words: ['red', 'der'], score: 2, result: { ranking: [['player1'], ['player2']] } });
}
