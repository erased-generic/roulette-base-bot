import { LetterState, Wordle } from '../../src/util/wordle';
import * as assert from 'assert';

class WordleTest extends Wordle {
  testGuessWord(player: string, args: string[]) {
    const { describe, ...result } = super.guessWord(player, [''].concat(args));
    return result;
  }
}

function toLetters(...arr: number[]): LetterState[] {
  return arr.map((i) => {
    switch (i) {
      case 1:
        return LetterState.WrongPosition;
      case 2:
        return LetterState.Correct;
      case 0:
      default:
        return LetterState.Wrong;
    }
  });
}

// basic test
{
  let counter = 0;
  const validGuesses = ['crane', 'plane', 'enarc'];
  function randomizer() {
    counter = counter % validGuesses.length;
    return counter++ / validGuesses.length;
  }
  let instance = new WordleTest(['player1', 'player2'], validGuesses, validGuesses, 0, randomizer);
  assert.strictEqual(instance.init(), undefined);
  assert.strictEqual(instance.isCurrentPlayer('player1'), true);
  assert.strictEqual(instance.isCurrentPlayer('player2'), true);
  assert.deepStrictEqual(instance.target, 'crane');
  assert.deepStrictEqual(instance.testGuessWord("player1", ["aaaaa"]), {
    guess: "aaaaa",
    result: undefined
  });
  assert.deepStrictEqual(instance.testGuessWord("player1", ["plane"]), {
    guess: "plane",
    letters: toLetters(0, 0, 2, 2, 2),
    result: undefined
  });
  assert.deepStrictEqual(instance.testGuessWord("player2", ["EnArC"]), {
    guess: "enarc",
    letters: toLetters(1, 1, 2, 1, 1),
    result: undefined
  });
  assert.deepStrictEqual(instance.testGuessWord("player1", ["crane"]), {
    guess: "crane",
    letters: toLetters(2, 2, 2, 2, 2),
    result: { ranking: [["player1"], ["player2"]] },
  });
}

// test with exceeding max guesses
{
  let counter = 0;
  const validGuesses = ['crane', 'plane', 'enarc'];
  function randomizer() {
    counter = counter % validGuesses.length;
    return counter++ / validGuesses.length;
  }
  let instance = new WordleTest(['player1', 'player2'], validGuesses, validGuesses, 2, randomizer);
  assert.strictEqual(instance.init(), undefined);
  assert.strictEqual(instance.isCurrentPlayer('player1'), true);
  assert.strictEqual(instance.isCurrentPlayer('player2'), true);
  assert.deepStrictEqual(instance.target, 'crane');
  assert.deepStrictEqual(instance.testGuessWord("player1", ["aaaaa"]), {
    guess: "aaaaa",
    result: undefined
  });
  assert.deepStrictEqual(instance.testGuessWord("player1", ["plane"]), {
    guess: "plane",
    letters: toLetters(0, 0, 2, 2, 2),
    result: undefined
  });
  assert.deepStrictEqual(instance.testGuessWord("player2", ["EnArC"]), {
    guess: "enarc",
    letters: toLetters(1, 1, 2, 1, 1),
    result: { ranking: [["player1"], ["player2"]] }
  });
}

// test with not exceeding max guesses
{
  let counter = 0;
  const validGuesses = ['crane', 'plane', 'enarc'];
  function randomizer() {
    counter = counter % validGuesses.length;
    return counter++ / validGuesses.length;
  }
  let instance = new WordleTest(['player1', 'player2'], validGuesses, validGuesses, 6, randomizer);
  assert.strictEqual(instance.init(), undefined);
  assert.strictEqual(instance.isCurrentPlayer('player1'), true);
  assert.strictEqual(instance.isCurrentPlayer('player2'), true);
  assert.deepStrictEqual(instance.target, 'crane');
  assert.deepStrictEqual(instance.testGuessWord("player1", ["aaaaa"]), {
    guess: "aaaaa",
    result: undefined
  });
  assert.deepStrictEqual(instance.testGuessWord("player1", ["plane"]), {
    guess: "plane",
    letters: toLetters(0, 0, 2, 2, 2),
    result: undefined
  });
  assert.deepStrictEqual(instance.testGuessWord("player2", ["EnArC"]), {
    guess: "enarc",
    letters: toLetters(1, 1, 2, 1, 1),
    result: undefined
  });
  assert.deepStrictEqual(instance.testGuessWord("player1", ["crane"]), {
    guess: "crane",
    letters: toLetters(2, 2, 2, 2, 2),
    result: { ranking: [["player1"], ["player2"]] },
  });
}
