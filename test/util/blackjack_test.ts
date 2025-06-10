import { BlackJack, Deck, Card, CardSuit } from '../../src/util/blackjack';
import * as assert from 'assert';

class BlackJackTest extends BlackJack {
  constructor(players: string[], deck: Deck) {
    super(players, deck);
  }

  testHit() {
    const { describe, ...result } = super.hit();
    return result;
  }

  testStand() {
    const { describe, ...result } = super.stand();
    return result;
  }
}

// Test general case
{
  let instance = new BlackJackTest(['player1', 'player2', 'player3', 'player4'], new Deck([
    new Card(5, CardSuit.Spade),
    new Card(10, CardSuit.Spade),
    new Card(2, CardSuit.Spade),

    new Card(4, CardSuit.Club),
    new Card(4, CardSuit.Diamond),

    new Card(1, CardSuit.Diamond),
    new Card(9, CardSuit.Club),

    new Card(1, CardSuit.Heart),
    new Card(10, CardSuit.Heart),

    new Card(9, CardSuit.Club),
    new Card(9, CardSuit.Diamond),
  ]));
  assert.deepStrictEqual(instance.init(), undefined);
  assert.strictEqual(BlackJack.getBalance(instance.hands['player1']), 18);
  assert.strictEqual(BlackJack.getBalance(instance.hands['player2']), 21);
  assert.strictEqual(BlackJack.getBalance(instance.hands['player3']), 20);
  assert.strictEqual(BlackJack.getBalance(instance.hands['player4']), 8);
  assert.strictEqual(instance.getCurrentPlayer(), 'player1');
  assert.deepStrictEqual(instance.testHit(), { card: new Card(2, CardSuit.Spade), balance: 20, result: undefined });
  assert.strictEqual(instance.getCurrentPlayer(), 'player1');
  // bust
  assert.deepStrictEqual(instance.testHit(), { card: new Card(10, CardSuit.Spade), balance: 30, result: undefined });
  // skip blackjacked player2
  assert.strictEqual(instance.getCurrentPlayer(), 'player3');
  // overflow Ace from 11 to 1
  assert.deepStrictEqual(instance.testHit(), { card: new Card(5, CardSuit.Spade), balance: 15, result: undefined });
  assert.strictEqual(instance.getCurrentPlayer(), 'player3');
  assert.deepStrictEqual(instance.testStand(), { balance: 15, result: undefined });
  assert.strictEqual(instance.getCurrentPlayer(), 'player4');
  assert.deepStrictEqual(instance.testStand(), { balance: 8, result: { ranking: [['player2'], ['player3'], ['player4'], ['player1']] } });
}

// Test duels
{
  let instance = new BlackJackTest(['player1', 'player2'], new Deck([
    new Card(4, CardSuit.Spade),

    new Card(9, CardSuit.Spade),
    new Card(9, CardSuit.Heart),

    new Card(9, CardSuit.Club),
    new Card(9, CardSuit.Diamond),
  ]));
  assert.deepStrictEqual(instance.init(), undefined);
  assert.strictEqual(BlackJack.getBalance(instance.hands['player1']), 18);
  assert.strictEqual(BlackJack.getBalance(instance.hands['player2']), 18);
  assert.strictEqual(instance.getCurrentPlayer(), 'player1');
  // bust
  assert.deepStrictEqual(instance.testHit(), {
    card: new Card(4, CardSuit.Spade),
    balance: 22,
    result: { ranking: [['player2'], ['player1']] }
  });
}

{
  let instance = new BlackJackTest(['player1', 'player2'], new Deck([
    new Card(3, CardSuit.Spade),

    new Card(9, CardSuit.Spade),
    new Card(9, CardSuit.Heart),

    new Card(9, CardSuit.Club),
    new Card(9, CardSuit.Diamond),
  ]));
  assert.deepStrictEqual(instance.init(), undefined);
  assert.strictEqual(BlackJack.getBalance(instance.hands['player1']), 18);
  assert.strictEqual(BlackJack.getBalance(instance.hands['player2']), 18);
  assert.strictEqual(instance.getCurrentPlayer(), 'player1');
  // 21
  assert.deepStrictEqual(instance.testHit(), {
    card: new Card(3, CardSuit.Spade),
    balance: 21,
    result: { ranking: [['player1'], ['player2']] }
  });
}

{
  let instance = new BlackJackTest(['player1', 'player2'], new Deck([
    new Card(3, CardSuit.Spade),

    new Card(9, CardSuit.Spade),
    new Card(9, CardSuit.Heart),

    new Card(9, CardSuit.Club),
    new Card(9, CardSuit.Diamond),
  ]));
  assert.deepStrictEqual(instance.init(), undefined);
  assert.strictEqual(BlackJack.getBalance(instance.hands['player1']), 18);
  assert.strictEqual(BlackJack.getBalance(instance.hands['player2']), 18);
  assert.strictEqual(instance.getCurrentPlayer(), 'player1');
  // stand
  assert.deepStrictEqual(instance.testStand(), {
    balance: 18,
    result: undefined
  });
  assert.strictEqual(instance.getCurrentPlayer(), 'player2');
  // stand, tie
  assert.deepStrictEqual(instance.testStand(), {
    balance: 18,
    result: { ranking: [['player1', 'player2']] }
  });
}

{
  let instance = new BlackJackTest(['player1', 'player2'], new Deck([
    new Card(3, CardSuit.Spade),

    new Card(10, CardSuit.Spade),
    new Card(9, CardSuit.Heart),

    new Card(9, CardSuit.Club),
    new Card(9, CardSuit.Diamond),
  ]));
  assert.deepStrictEqual(instance.init(), undefined);
  assert.strictEqual(BlackJack.getBalance(instance.hands['player1']), 18);
  assert.strictEqual(BlackJack.getBalance(instance.hands['player2']), 19);
  assert.strictEqual(instance.getCurrentPlayer(), 'player1');
  // stand
  assert.deepStrictEqual(instance.testStand(), {
    balance: 18,
    result: undefined
  });
  assert.strictEqual(instance.getCurrentPlayer(), 'player2');
  // stand, tie
  assert.deepStrictEqual(instance.testStand(), {
    balance: 19,
    result: { ranking: [['player2'], ['player1']] }
  });
}

{
  let instance = new BlackJackTest(['player1', 'player2'], new Deck([
    new Card(3, CardSuit.Spade),

    new Card(10, CardSuit.Spade),
    new Card(9, CardSuit.Heart),

    new Card(1, CardSuit.Club),
    new Card(10, CardSuit.Diamond),
  ]));
  // instant blackjack
  assert.deepStrictEqual(instance.init(), { ranking: [['player1'], ['player2']] });
}

{
  let instance = new BlackJackTest(['player1', 'player2'], new Deck([
    new Card(1, CardSuit.Heart),
    new Card(1, CardSuit.Spade),

    new Card(10, CardSuit.Spade),
    new Card(9, CardSuit.Heart),

    new Card(1, CardSuit.Club),
    new Card(1, CardSuit.Diamond),
  ]));
  assert.deepStrictEqual(instance.init(), undefined);
  assert.strictEqual(BlackJack.getBalance(instance.hands['player1']), 12);
  assert.strictEqual(BlackJack.getBalance(instance.hands['player2']), 19);
  assert.strictEqual(instance.getCurrentPlayer(), 'player1');
  // overflow ace -> 1
  assert.deepStrictEqual(instance.testHit(), {
    card: new Card(1, CardSuit.Spade),
    balance: 13,
    result: undefined
  });
  // overflow another ace -> 1
  assert.deepStrictEqual(instance.testHit(), {
    card: new Card(1, CardSuit.Heart),
    balance: 14,
    result: undefined
  });
}
