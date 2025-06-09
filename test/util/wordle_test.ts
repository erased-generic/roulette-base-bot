import { LetterState, Wordle } from '../../src/util/wordle';
import * as assert from 'assert';

class WordleTest extends Wordle {
  guessWord(player: string, args: string[]) {
    const result = super.guessWord(player, [''].concat(args));
    delete result.describe;
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
  let instance = new WordleTest(['player1', 'player2'], validGuesses, validGuesses, randomizer);
  assert.strictEqual(instance.init(), undefined);
  assert.strictEqual(instance.isCurrentPlayer('player1'), true);
  assert.strictEqual(instance.isCurrentPlayer('player2'), true);
  assert.deepStrictEqual(instance.target, 'crane');
  assert.deepStrictEqual(instance.guessWord("player1", ["aaaaa"]), {
    guess: "aaaaa",
    letters: undefined,
    result: undefined
  });
  assert.deepStrictEqual(instance.guessWord("player1", ["plane"]), {
    guess: "plane",
    letters: toLetters(0, 0, 2, 2, 2),
    result: undefined
  });
  assert.deepStrictEqual(instance.guessWord("player2", ["EnArC"]), {
    guess: "enarc",
    letters: toLetters(1, 1, 2, 1, 1),
    result: undefined
  });
  assert.deepStrictEqual(instance.guessWord("player1", ["crane"]), {
    guess: "crane",
    letters: toLetters(2, 2, 2, 2, 2),
    result: { ranking: [["player1"], ["player2"]] },
  });
}
