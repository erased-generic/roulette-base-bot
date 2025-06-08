import Fraction from 'fraction.js';
import { Bet, RouletteBase, Roulette, Prediction } from '../../src/util/roulette';
import * as assert from 'assert';

interface ExpectedWinning {
  didWin: boolean;
  chance: number;
  amount: number;
  payout: number;
}

function testRouletteBase(instance: RouletteBase, bets: { [key: string]: Bet }, winningNumber: number, expected: { [key: string]: ExpectedWinning }) {
  for (const playerId in bets) {
    instance.placeBet(playerId, bets[playerId].amount, bets[playerId].numbers);
  }
  instance.winningNumber = winningNumber;
  let called = {};
  instance.computeWinnings(
    (
      playerId: string,
      didWin: boolean,
      chance: number,
      amount: number,
      payout: Fraction
    ) => {
      assert.strictEqual(playerId in expected, true);
      assert.strictEqual(didWin, expected[playerId].didWin);
      assert.strictEqual(amount, expected[playerId].amount);
      if (Number.isNaN(expected[playerId].chance)) {
        assert.ok(Number.isNaN(chance));
      } else {
        assert.ok(Math.abs(expected[playerId].chance - chance) < 0.0001);
      }
      assert.strictEqual(payout.valueOf(), expected[playerId].payout);
      called[playerId] = true;
    }
  );

  for (const playerId in expected) {
    assert.strictEqual(called[playerId], true);
  }
}

// Test all roulette bets
testRouletteBase(new Roulette(37),
  { player1: { amount: 10, numbers: [1] } }, 1,
  { player1: { didWin: true, chance: 1 / (36 + 1), amount: 10, payout: 350 } });

testRouletteBase(new Roulette(37),
  { player1: { amount: 10, numbers: [1] } }, 0,
  { player1: { didWin: false, chance: 1 / (36 + 1), amount: 10, payout: -10 } });

testRouletteBase(new Roulette(37),
  { player1: { amount: 10, numbers: [1, 2] } }, 1,
  { player1: { didWin: true, chance: 2 / (37), amount: 10, payout: 170 } });
testRouletteBase(new Roulette(37),
  { player1: { amount: 10, numbers: [1, 2] } }, 3,
  { player1: { didWin: false, chance: 2 / (37), amount: 10, payout: -10 } });

testRouletteBase(new Roulette(37),
  { player1: { amount: 10, numbers: [1, 2, 3] } }, 1,
  { player1: { didWin: true, chance: 1 / (11 + 1/3 + 1), amount: 10, payout: 110 } });
testRouletteBase(new Roulette(37),
  { player1: { amount: 10, numbers: [1, 2, 3] } }, 0,
  { player1: { didWin: false, chance: 1 / (11 + 1/3 + 1), amount: 10, payout: -10 } });

testRouletteBase(new Roulette(37),
  { player1: { amount: 10, numbers: [1, 2, 3, 4] } }, 1,
  { player1: { didWin: true, chance: 1/(8 + 1/4 + 1), amount: 10, payout: 80 } });
testRouletteBase(new Roulette(37),
  { player1: { amount: 10, numbers: [1, 2, 3, 4] } }, 0,
  { player1: { didWin: false, chance: 1/(8 + 1/4 + 1), amount: 10, payout: -10 } });

testRouletteBase(new Roulette(37),
  { player1: { amount: 10, numbers: [1, 2, 3, 4, 5, 6] } }, 1,
  { player1: { didWin: true, chance: 1/(5 + 1/6 + 1), amount: 10, payout: 50 } });
testRouletteBase(new Roulette(37),
  { player1: { amount: 10, numbers: [1, 2, 3, 4, 5, 6] } }, 0,
  { player1: { didWin: false, chance: 1/(5 + 1/6 + 1), amount: 10, payout: -10 } });

testRouletteBase(new Roulette(37),
  { player1: { amount: 10, numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] } }, 1,
  { player1: { didWin: true, chance: 1/(2 + 1/12 + 1), amount: 10, payout: 20 } });
testRouletteBase(new Roulette(37),
  { player1: { amount: 10, numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] } }, 0,
  { player1: { didWin: false, chance: 1/(2 + 1/12 + 1), amount: 10, payout: -10 } });

testRouletteBase(new Roulette(37),
  { player1: { amount: 10, numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] } }, 1,
  { player1: { didWin: true, chance: 1/(1 + 1/18 + 1), amount: 10, payout: 10 } });
testRouletteBase(new Roulette(37),
  { player1: { amount: 10, numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] } }, 0,
  { player1: { didWin: false, chance: 1/(1 + 1/18 + 1), amount: 10, payout: -10 } });

testRouletteBase(new Roulette(37),
  { player1: { amount: 10, numbers: RouletteBase.getAllNumbers(37) } }, 1,
  { player1: { didWin: true, chance: 1, amount: 10, payout: -10 / 37 } });

// Test that roulette bets are independent
testRouletteBase(new Roulette(37), {
  player1: { amount: 10, numbers: [1, 2] },
  player2: { amount: 10, numbers: [1, 2, 3, 4, 5, 6] }
}, 1, {
  player1: { didWin: true, chance: 2/37, amount: 10, payout: 170 },
  player2: { didWin: true, chance: 1/(5 + 1/6 + 1), amount: 10, payout: 50 }
});
testRouletteBase(new Roulette(37), {
  player1: { amount: 10, numbers: [7, 8] },
  player2: { amount: 10, numbers: [1, 2, 3, 4, 5, 6] }
}, 1, {
  player1: { didWin: false, chance: 2/37, amount: 10, payout: -10 },
  player2: { didWin: true, chance: 1/(5 + 1/6 + 1), amount: 10, payout: 50 }
});
testRouletteBase(new Roulette(37), {
  player1: { amount: 10, numbers: [7, 8] },
  player2: { amount: 10, numbers: [1, 2, 3, 4, 5, 6] }
}, 7, {
  player1: { didWin: true, chance: 2/37, amount: 10, payout: 170 },
  player2: { didWin: false, chance: 1/(5 + 1/6 + 1), amount: 10, payout: -10 }
});
testRouletteBase(new Roulette(37), {
  player1: { amount: 10, numbers: [7, 8] },
  player2: { amount: 10, numbers: [1, 2, 3, 4, 5, 6] }
}, 10, {
  player1: { didWin: false, chance: 2/37, amount: 10, payout: -10 },
  player2: { didWin: false, chance: 1/(5 + 1/6 + 1), amount: 10, payout: -10 }
});
testRouletteBase(new Roulette(37), {
  player1: { amount: 0, numbers: [7, 8] },
  player2: { amount: 10, numbers: [1, 2, 3, 4, 5, 6] }
}, 7, {
  player1: { didWin: true, chance: 2/37, amount: 0, payout: 0 },
  player2: { didWin: false, chance: 1/(5 + 1/6 + 1), amount: 10, payout: -10 }
});

// Test predictions: normal cases
testRouletteBase(new Prediction(2),
  { player1: { amount: 10, numbers: [1] } }, 1,
  { player1: { didWin: true, chance: 1, amount: 10, payout: 0 } });
testRouletteBase(new Prediction(3), {
  player1: { amount: 10, numbers: [1] },
  player2: { amount: 10, numbers: [2] }
}, 1, {
  player1: { didWin: true, chance: 1/2, amount: 10, payout: 10 },
  player2: { didWin: false, chance: 1/2, amount: 10, payout: -10 }
});
testRouletteBase(new Prediction(3), {
  player1: { amount: 10, numbers: [1] },
  player2: { amount: 100, numbers: [2] }
}, 1, {
  player1: { didWin: true, chance: 1/11, amount: 10, payout: 100 },
  player2: { didWin: false, chance: 10/11, amount: 100, payout: -100 }
});
testRouletteBase(new Prediction(3), {
  player1: { amount: 9, numbers: [1] },
  player2: { amount: 1, numbers: [1] },
  player3: { amount: 100, numbers: [2] }
}, 1, {
  player1: { didWin: true, chance: 1/11, amount: 9, payout: 90 },
  player2: { didWin: true, chance: 1/11, amount: 1, payout: 10 },
  player3: { didWin: false, chance: 10/11, amount: 100, payout: -100 }
});
testRouletteBase(new Prediction(4), {
  player1: { amount: 9, numbers: [1] },
  player2: { amount: 1, numbers: [1] },
  player3: { amount: 50, numbers: [2] },
  player4: { amount: 50, numbers: [3] }
}, 1, {
  player1: { didWin: true, chance: 1/11, amount: 9, payout: 90 },
  player2: { didWin: true, chance: 1/11, amount: 1, payout: 10 },
  player3: { didWin: false, chance: 5/11, amount: 50, payout: -50 },
  player4: { didWin: false, chance: 5/11, amount: 50, payout: -50 }
});
testRouletteBase(new Prediction(4), {
  player1: { amount: 9, numbers: [1] },
  player2: { amount: 1, numbers: [1] },
  player3: { amount: 50, numbers: [2] },
  player4: { amount: 50, numbers: [3] },
  player5: { amount: 9, numbers: [1, 2, 3] }
}, 1, {
  player1: { didWin: true, chance: 13/119, amount: 9, payout: 9 * (119 / 13 - 1) },  // 73.385
  player2: { didWin: true, chance: 13/119, amount: 1, payout: 1 * (119 / 13 - 1) },  // 8.154
  player3: { didWin: false, chance: 53/119, amount: 50, payout: -50 },                // -50
  player4: { didWin: false, chance: 53/119, amount: 50, payout: -50 },                // -50
  player5: { didWin: true, chance: 1, amount: 9, payout: -3 - 3 + 3 * (119 / 13 - 1) } // 18.462
});

// Test prediction: edge cases with 0 bets
// test chance rescale from 0 (controversial)
testRouletteBase(new Prediction(5), {
  player1: { amount: 0, numbers: [1] },
  player2: { amount: 0, numbers: [1, 2] },
  player3: { amount: 0, numbers: [2] },
  player4: { amount: 0, numbers: [3] },
  player5: { amount: 100, numbers: [4] }
}, 1, {
  player1: { didWin: true, chance: 0, amount: 0, payout: 100 * 2 / 3 }, // get more weight
  player2: { didWin: true, chance: 1, amount: 0, payout: 100 * 1 / 3 },     // voted 2 -> less weight
  player3: { didWin: false, chance: 1, amount: 0, payout: 0 },
  player4: { didWin: false, chance: 1, amount: 0, payout: 0 },
  player5: { didWin: false, chance: 1, amount: 100, payout: -100 }
});
// test no chance rescale, if the 0-bet didn't win
testRouletteBase(new Prediction(4), {
  player1: { amount: 0, numbers: [1] },
  player2: { amount: 0, numbers: [1, 2] },
  player3: { amount: 50, numbers: [2] },
  player4: { amount: 50, numbers: [3] }
}, 3, {
  player1: { didWin: false, chance: 0, amount: 0, payout: 0 },
  player2: { didWin: false, chance: 1/2, amount: 0, payout: 0 },
  player3: { didWin: false, chance: 1/2, amount: 50, payout: -50 },
  player4: { didWin: true, chance: 1/2, amount: 50, payout: 50 }
});
// test 0-sum: "rescale" chances, as if each player bet 1 in total
testRouletteBase(new Prediction(4), {
  player1: { amount: 0, numbers: [1] },
}, 1, {
  player1: { didWin: true, chance: 1, amount: 0, payout: 0 },
});
testRouletteBase(new Prediction(4), {
  player1: { amount: 0, numbers: [1] },
}, 2, {
  player1: { didWin: false, chance: 1, amount: 0, payout: 0 },
});
testRouletteBase(new Prediction(4), {
  player1: { amount: 0, numbers: [1] },
  player2: { amount: 0, numbers: [1, 2] },
  player3: { amount: 0, numbers: [2] },
  player4: { amount: 0, numbers: [3] }
}, 1, {
  player1: { didWin: true, chance: 1/4 + 1/8, amount: 0, payout: 0 },
  player2: { didWin: true, chance: 1/4 + 1/8 + 1/8 + 1/4, amount: 0, payout: 0 },
  player3: { didWin: false, chance: 1/8 + 1/4, amount: 0, payout: 0 },
  player4: { didWin: false, chance: 1/4, amount: 0, payout: 0 }
});
