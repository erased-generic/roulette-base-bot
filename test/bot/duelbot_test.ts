import {
  DuelCommand,
  DuelBot,
  DuelAccepted,
  DuelImpl,
} from "../../src/bot/duelbot";
import { BlackJackDuelImpl } from "../../src/bot/blackjackduelimpl";
import {
  ChatContext,
  Game,
  GameBrain,
  GameResult,
} from "../../src/util/interfaces";
import {
  BlackJack,
  BlackJackBrain,
  Card,
  CardSuit,
  Deck,
  Moves,
} from "../../src/util/blackjack";
import {
  createTestBot,
  createTestBotConfig,
  instanceTestHandler,
  instanceTestParser,
  setBalanceNoReserved,
} from "./utils";
import { AnagramsDuelImpl } from "../../src/bot/anagramsduelimpl";
import { DoNothingBrain, WordleDuelImpl } from "../../src/bot/wordleduelimpl";

function parse(args: string[]) {
  return DuelBot.parseDuelCommand(
    ["", ...args],
    ["testduelname", "testduelname2"]
  );
}

function testParser(command: string, expected: DuelCommand | undefined) {
  return instanceTestParser(parse, command, expected);
}

class TestGame implements Game {
  players: string[] = [];

  constructor(players: string[]) {
    this.players = players;
  }

  getPlayers(): string[] {
    return this.players;
  }
  isCurrentPlayer(playerId: string): boolean {
    return true;
  }
  init(): GameResult | undefined {
    return undefined;
  }
  moveHandlers = {
    nop: (userId, args) => ({
      result: undefined,
      describe: () => "nothing happened",
    }),
  };
}

class TestDuelImpl extends DuelImpl<TestGame> {
  duelDescription: string = "test duel";
  readonly handlers = {};
  readonly bindMoves = {
    nop: {
      description: "nop",
      format: "",
    },
  };
  readonly gameBrain?: GameBrain<TestGame> = undefined;

  printDuelIntro(bot: DuelBot, duel: DuelAccepted<TestGame>): string {
    return "test duel intro";
  }
  printDuelStatus(
    bot: DuelBot,
    duel: DuelAccepted<TestGame>,
    moreInfo: boolean
  ): string {
    return "test duel status";
  }
  printDuelPrompt(
    bot: DuelBot,
    duel: DuelAccepted<TestGame>,
    moreInfo: boolean
  ): string {
    return "test duel prompt";
  }
  printDuelResult(
    bot: DuelBot,
    duel: DuelAccepted<TestGame>,
    moreInfo: boolean,
    result: GameResult
  ): string {
    return "test duel result";
  }
  createDuelPayload(bot: DuelBot, players: string[], args: string[]): TestGame {
    return new TestGame(players);
  }
}

/*
 * test interface
 */

// first, test rendezvous mechanism
const config = createTestBotConfig();
const userData = config.userData;
const myDeck = new Deck();
let instance = createTestBot(
  [
    new DuelBot({
      ...config,
      playerShuffleChance: 0, // don't shuffle players
      duelImpls: {
        testduelname: new TestDuelImpl(),
      },
    }),
  ],
  config
);

testParser("100 aaa", {
  amount: 100,
  username: "aaa",
  duelName: "testduelname",
});
testParser("100 1212", {
  amount: 100,
  username: "1212",
  duelName: "testduelname",
});
testParser("100 aaa bbb", undefined);

// Test the bot itself
const aChatContext = { username: "a", "user-id": "a", mod: false };
const bChatContext = { username: "b", "user-id": "b", mod: false };
const cChatContext = { username: "c", "user-id": "c", mod: false };
const dChatContext = { username: "d", "user-id": "d", mod: false };

function testHandler(context: ChatContext, command: string, expected: RegExp) {
  return instanceTestHandler(instance, context, command, expected);
}

// ensure initial balance
testHandler(aChatContext, "!balance", /You have 100 points/);
testHandler(bChatContext, "!balance", /You have 100 points/);
testHandler(cChatContext, "!balance", /You have 100 points/);
testHandler(dChatContext, "!balance", /You have 100 points/);

// test duels interface
testHandler(aChatContext, "!accept", /no one requested a duel with you/);
testHandler(aChatContext, "!accept b", /b didn't request a duel with you/);
testHandler(
  aChatContext,
  "!rendezvous",
  /a, you are participating in: no duels or requests/
);
testHandler(
  bChatContext,
  "!rendezvous",
  /b, you are participating in: no duels or requests/
);
testHandler(aChatContext, "!check", /a, you're not in any duel/);
testHandler(bChatContext, "!check", /b, you're not in any duel/);
testHandler(
  aChatContext,
  "!duel 10 b",
  /b, reply with !accept \[a\] to accept the test duel, if you're ready to bet 10 points!/
);
testHandler(
  bChatContext,
  "!duel 10 a",
  /a, reply with !accept \[b\] to accept the test duel, if you're ready to bet 10 points!/
);
testHandler(
  bChatContext,
  "!rendezvous",
  /b, you are participating in: a test duel request a -> b;\s+a test duel request b -> a$/
);
testHandler(
  aChatContext,
  "!rendezvous",
  /a, you are participating in: a test duel request a -> b;\s+a test duel request b -> a$/
);
testHandler(aChatContext, "!check", /a, you're not in any duel/);
testHandler(bChatContext, "!check", /b, you're not in any duel/);
testHandler(aChatContext, "!unduel", /a retracted all their duel requests/);
testHandler(bChatContext, "!unduel", /b retracted all their duel requests/);
testHandler(aChatContext, "!duel 1000 b", /You don't have that many points/);
testHandler(
  aChatContext,
  "!duel -1000 b",
  /You can bet only a positive amount of points/
);
testHandler(aChatContext, "!duel lol b", /error/);
testHandler(bChatContext, "!balance", /You have 100 points, b!/);
testHandler(
  bChatContext,
  "!duel all a",
  /a, reply with !accept \[b\] to accept the test duel, if you're ready to bet 100 points!/
);

// test that duel requests overwrite each other
testHandler(
  aChatContext,
  "!duel 10 b",
  /b, reply with !accept \[a\] to accept the test duel, if you're ready to bet 10 points!/
);
testHandler(
  aChatContext,
  "!balance",
  /You have 100 points \(currently betted 10 of those\), a!/
);
testHandler(
  aChatContext,
  "!duel 30 b",
  /b, reply with !accept \[a\] to accept the test duel, if you're ready to bet 30 points!/
);
testHandler(
  aChatContext,
  "!balance",
  /You have 100 points \(currently betted 30 of those\), a!/
);

// test that we can duel all-in even if we have 0 points
testHandler(aChatContext, "!unduel", /a retracted all their duel requests/);
setBalanceNoReserved(userData, "a", 0);
testHandler(
  aChatContext,
  "!duel all b",
  /b, reply with !accept \[a\] to accept the test duel, if you're ready to bet 0 points!/
);

// test that you go all-in if you don't have enough points for accepting the duel
testHandler(aChatContext, "!unduel", /a retracted all their duel requests/);
setBalanceNoReserved(userData, "a", 10);
testHandler(
  bChatContext,
  "!duel 30 a",
  /a, reply with !accept \[b\] to accept the test duel, if you're ready to bet 30 points!/
);
testHandler(aChatContext, "!accept", /a is going all-in with 10 points!/);
testHandler(aChatContext, "!unduel", /a forfeits the test duel/);

/*
 * test blackjack
 */
myDeck.cards = new Deck().cards;
instance = createTestBot(
  [
    new DuelBot({
      ...config,
      playerShuffleChance: 0,
      duelImpls: {
        bj: new BlackJackDuelImpl({
          deckGenerator: () => myDeck,
          gameBrain: new BlackJackBrain(0),
        }), // use this deck interface and don't shuffle players
      },
    }),
  ],
  config
);
setBalanceNoReserved(userData, "a", 100);
setBalanceNoReserved(userData, "b", 100);
testHandler(
  bChatContext,
  "!duel 10 a",
  /a, reply with !accept \[b\] to accept the blackjack duel, if you're ready to bet 10 points!/
);
testHandler(cChatContext, "!accept b", /b didn't request a duel with you/);
testHandler(
  aChatContext,
  "!accept",
  /Let the blackjack duel begin[\s\S]*b's hand: K♦,K♠, totaling 20;\s+a's hand: K♣,K♥, totaling 20\.[\s\S]*b, your move!/
);
testHandler(
  bChatContext,
  "!accept",
  /b, you already have a blackjack duel in progress with a/
);
testHandler(
  aChatContext,
  "!accept",
  /a, you already have a blackjack duel in progress with b/
);
testHandler(
  aChatContext,
  "!rendezvous",
  /a, you are participating in: an ongoing blackjack duel b <-> a$/
);
testHandler(
  bChatContext,
  "!rendezvous",
  /b, you are participating in: an ongoing blackjack duel b <-> a$/
);
testHandler(
  aChatContext,
  "!check",
  /b's hand: K♦,K♠, totaling 20;\s+a's hand: K♣,K♥, totaling 20\.[\s\S]*b, your move!/
);
testHandler(
  bChatContext,
  "!check",
  /b's hand: K♦,K♠, totaling 20;\s+a's hand: K♣,K♥, totaling 20\.[\s\S]*b, your move!/
);
testHandler(
  aChatContext,
  "!balance",
  /You have 100 points \(currently betted 10 of those\), a!/
);
testHandler(
  bChatContext,
  "!balance",
  /You have 100 points \(currently betted 10 of those\), b!/
);
testHandler(cChatContext, "!accept b", /b is busy/);
testHandler(bChatContext, "!duel 10 c", /Duel already in progress/);
testHandler(aChatContext, "!duel 10 c", /Duel already in progress/);
testHandler(cChatContext, "!stand", /not in a duel/);
testHandler(aChatContext, "!stand", /it's not your turn/);
testHandler(bChatContext, "!stand", /a, your move/);
testHandler(bChatContext, "!hit", /it's not your turn/);
testHandler(aChatContext, "!stand", /a tie/);
testHandler(aChatContext, "!balance", /You have 100 points, a!/);
testHandler(bChatContext, "!balance", /You have 100 points, b!/);
testHandler(aChatContext, "!check", /duel result was: you tied with b/);
testHandler(bChatContext, "!check", /duel result was: you tied with a/);

// test winning
myDeck.cards = [
  new Card(12, CardSuit.Club),
  new Card(2, CardSuit.Diamond),

  new Card(9, CardSuit.Heart),
  new Card(9, CardSuit.Spade),

  new Card(9, CardSuit.Club),
  new Card(9, CardSuit.Diamond),
];
setBalanceNoReserved(userData, "a", 100);
setBalanceNoReserved(userData, "b", 100);
testHandler(
  bChatContext,
  "!duel 10 a",
  /a, reply with !accept \[b\] to accept the blackjack duel, if you're ready to bet 10 points!/
);
testHandler(
  aChatContext,
  "!accept",
  /Let the blackjack duel begin[\s\S]*b's hand: 9♦,9♣, totaling 18;\s+a's hand: 9♠,9♥, totaling 18\.[\s\S]*b, your move!/
);
testHandler(
  aChatContext,
  "!balance",
  /You have 100 points \(currently betted 10 of those\), a!/
);
testHandler(
  bChatContext,
  "!balance",
  /You have 100 points \(currently betted 10 of those\), b!/
);
testHandler(bChatContext, "!hit", /b pulls a 2♦, totaling 20! b, your move!/);
testHandler(
  bChatContext,
  "!check",
  /b's hand: 9♦,9♣,2♦, totaling 20;\s+a's hand: 9♠,9♥, totaling 18\.[\s\S]*b, your move!/
);
testHandler(bChatContext, "!stand", /b stands with 20\.[\s\S]*a, your move!/);
testHandler(
  aChatContext,
  "!hit",
  /Q♣, totaling 28 - they busted! The winner is b;\s+b won 10 points and now has 110 points;\s+a lost 10 points and now has 90 points/
);
testHandler(aChatContext, "!balance", /You have 90 points, a!/);
testHandler(bChatContext, "!balance", /You have 110 points, b!/);
testHandler(aChatContext, "!check", /duel result was: you lost to b/);
testHandler(bChatContext, "!check", /duel result was: you won against a/);

// test instant winning
myDeck.cards = [
  new Card(9, CardSuit.Club),
  new Card(9, CardSuit.Diamond),

  new Card(1, CardSuit.Heart),
  new Card(10, CardSuit.Heart),
];
setBalanceNoReserved(userData, "a", 100);
setBalanceNoReserved(userData, "b", 100);
testHandler(
  bChatContext,
  "!duel 10 a",
  /a, reply with !accept \[b\] to accept the blackjack duel, if you're ready to bet 10 points!/
);
testHandler(
  aChatContext,
  "!accept",
  new RegExp(
    "Let the blackjack duel begin[\\s\\S]*" +
      "b's hand: 10♥,A♥, totaling 21;\\s+a's hand: 9♦,9♣, totaling 18.[\\s\\S]*" +
      "The winner is b;\\s+b won 10 points and now has 110 points;\\s+a lost 10 points and now has 90 points"
  )
);
testHandler(aChatContext, "!balance", /You have 90 points, a!/);
testHandler(bChatContext, "!balance", /You have 110 points, b!/);
testHandler(aChatContext, "!check", /duel result was: you lost to b/);
testHandler(bChatContext, "!check", /duel result was: you won against a/);

// test winning with all-in 0 points
myDeck.cards = new Deck().cards;
setBalanceNoReserved(userData, "a", 0);
setBalanceNoReserved(userData, "b", 100);
testHandler(
  bChatContext,
  "!duel 10 a",
  /a, reply with !accept \[b\] to accept the blackjack duel, if you're ready to bet 10 points!/
);
testHandler(
  aChatContext,
  "!accept",
  /Let the blackjack duel begin[\s\S]*b's hand: K♦,K♠, totaling 20;\s+a's hand: K♣,K♥, totaling 20\.[\s\S]*b, your move!/
);
testHandler(aChatContext, "!balance", /You have 0 points, a!/);
testHandler(
  bChatContext,
  "!balance",
  /You have 100 points \(currently betted 10 of those\), b!/
);
testHandler(
  bChatContext,
  "!hit",
  /Q♦, totaling 30 - they busted! The winner is a;\s+b lost 10 points and now has 90 points;\s+a won 10 points and now has 10 points/
);
testHandler(aChatContext, "!balance", /You have 10 points, a!/);
testHandler(bChatContext, "!balance", /You have 90 points, b!/);

// test two duels at once
myDeck.cards = [
  new Card(8, CardSuit.Heart),
  new Card(8, CardSuit.Spade),

  new Card(8, CardSuit.Club),
  new Card(8, CardSuit.Diamond),

  new Card(9, CardSuit.Heart),
  new Card(9, CardSuit.Spade),

  new Card(9, CardSuit.Club),
  new Card(9, CardSuit.Diamond),

  new Card(10, CardSuit.Heart),
  new Card(10, CardSuit.Spade),

  new Card(10, CardSuit.Club),
  new Card(10, CardSuit.Diamond),
];
const myDeck2 = new Deck();
myDeck2.cards = [
  new Card(8, CardSuit.Heart),
  new Card(8, CardSuit.Spade),

  new Card(8, CardSuit.Club),
  new Card(8, CardSuit.Diamond),

  new Card(9, CardSuit.Heart),
  new Card(9, CardSuit.Spade),
];
let isFirst = true;
instance = createTestBot(
  [
    new DuelBot({
      ...config,
      playerShuffleChance: 1,
      duelImpls: {
        bj: new BlackJackDuelImpl({
          deckGenerator: () => {
            if (isFirst) {
              isFirst = false;
              return myDeck;
            } else {
              return myDeck2;
            }
          },
          gameBrain: new BlackJackBrain(0),
        }), // use different decks for the two duels, also swap players
      },
    }),
  ],
  config
);

userData.get("a").balance = 100;
userData.get("b").balance = 100;
userData.get("c").balance = 100;
userData.get("d").balance = 100;
testHandler(
  bChatContext,
  "!duel 10 a",
  /a, reply with !accept \[b\] to accept the blackjack duel, if you're ready to bet 10 points!/
);
testHandler(
  cChatContext,
  "!duel 20 d",
  /d, reply with !accept \[c\] to accept the blackjack duel, if you're ready to bet 20 points!/
);
testHandler(dChatContext, "!accept b", /d, b didn't request a duel with you!/);
testHandler(dChatContext, "!accept a", /d, a didn't request a duel with you!/);
testHandler(aChatContext, "!accept d", /a, d didn't request a duel with you!/);
testHandler(aChatContext, "!accept c", /a, c didn't request a duel with you!/);
testHandler(
  aChatContext,
  "!rendezvous",
  /a, you are participating in: a blackjack duel request b -> a$/
);
testHandler(
  bChatContext,
  "!rendezvous",
  /b, you are participating in: a blackjack duel request b -> a$/
);
testHandler(
  cChatContext,
  "!rendezvous",
  /c, you are participating in: a blackjack duel request c -> d$/
);
testHandler(
  dChatContext,
  "!rendezvous",
  /d, you are participating in: a blackjack duel request c -> d$/
);
testHandler(
  aChatContext,
  "!accept",
  new RegExp(
    "Let the blackjack duel begin[\\s\\S]*" +
      "b's hand: 10♠,10♥, totaling 20;\\s+" +
      "a's hand: 10♦,10♣, totaling 20.[\\s\\S]*" +
      "a, your move!"
  )
);
testHandler(
  aChatContext,
  "!rendezvous",
  /a, you are participating in: an ongoing blackjack duel b <-> a$/
);
testHandler(
  bChatContext,
  "!rendezvous",
  /b, you are participating in: an ongoing blackjack duel b <-> a$/
);
testHandler(
  cChatContext,
  "!rendezvous",
  /c, you are participating in: a blackjack duel request c -> d$/
);
testHandler(
  dChatContext,
  "!rendezvous",
  /d, you are participating in: a blackjack duel request c -> d$/
);
testHandler(
  dChatContext,
  "!accept",
  new RegExp(
    "Let the blackjack duel begin[\\s\\S]*" +
      "c's hand: 8♦,8♣, totaling 16;\\s+" +
      "d's hand: 9♠,9♥, totaling 18.[\\s\\S]*" +
      "d, your move!"
  )
);
testHandler(
  aChatContext,
  "!rendezvous",
  /a, you are participating in: an ongoing blackjack duel b <-> a$/
);
testHandler(
  bChatContext,
  "!rendezvous",
  /b, you are participating in: an ongoing blackjack duel b <-> a$/
);
testHandler(
  cChatContext,
  "!rendezvous",
  /c, you are participating in: an ongoing blackjack duel c <-> d$/
);
testHandler(
  dChatContext,
  "!rendezvous",
  /d, you are participating in: an ongoing blackjack duel c <-> d$/
);
testHandler(aChatContext, "!stand", /b, your move/);
testHandler(dChatContext, "!stand", /c, your move/);
testHandler(
  bChatContext,
  "!hit",
  new RegExp(
    "b pulls a 9♦, totaling 29 - they busted! " +
      "The winner is a;\\s+b lost 10 points and now has 90 points;\\s+" +
      "a won 10 points and now has 110 points"
  )
);
testHandler(aChatContext, "!rendezvous", /a, you are participating in: no/);
testHandler(bChatContext, "!rendezvous", /b, you are participating in: no/);
testHandler(
  cChatContext,
  "!rendezvous",
  /c, you are participating in: an ongoing blackjack duel c <-> d$/
);
testHandler(
  dChatContext,
  "!rendezvous",
  /d, you are participating in: an ongoing blackjack duel c <-> d$/
);
testHandler(
  cChatContext,
  "!stand",
  /The winner is d;\s+c lost 20 points and now has 80 points;\s+d won 20 points and now has 120 points/
);
testHandler(aChatContext, "!rendezvous", /a, you are participating in: no/);
testHandler(bChatContext, "!rendezvous", /b, you are participating in: no/);
testHandler(cChatContext, "!rendezvous", /c, you are participating in: no/);
testHandler(dChatContext, "!rendezvous", /d, you are participating in: no/);
testHandler(aChatContext, "!balance", /You have 110 points, a!/);
testHandler(bChatContext, "!balance", /You have 90 points, b!/);
testHandler(cChatContext, "!balance", /You have 80 points, c!/);
testHandler(dChatContext, "!balance", /You have 120 points, d!/);

// check duels with the bot itself
instance = createTestBot(
  [
    new DuelBot({
      ...config,
      playerShuffleChance: 1,
      duelImpls: {
        bj: new BlackJackDuelImpl({
          deckGenerator: () => myDeck,
          gameBrain: new BlackJackBrain(1),
        }),
      },
    }),
  ],
  config
);
testHandler(aChatContext, "!duel all testbot", /maybe another time/);

let moves: Moves[] = [];
const seqBrain = new (class extends GameBrain<BlackJack> {
  requestGame(
    userId: string,
    username: string,
    args: string[]
  ): { args: string[] } {
    return { args: [] };
  }
  move(game: BlackJack) {
    if (moves.length === 0) {
      return undefined;
    }
    const move = moves.pop()!;
    return { move, args: [] };
  }
})();
myDeck.cards = new Deck().cards;
instance = createTestBot(
  [
    new DuelBot({
      ...config,
      playerShuffleChance: 1,
      duelImpls: {
        bj: new BlackJackDuelImpl({
          deckGenerator: () => myDeck,
          gameBrain: seqBrain,
        }),
      },
    }),
  ],
  config
);
setBalanceNoReserved(userData, "a", 100);
setBalanceNoReserved(userData, "testbot", 0);
moves = [Moves.Hit];
testHandler(
  aChatContext,
  "!duel 10 testbot",
  new RegExp(
    "I accept! Let the blackjack duel begin!\ntestbot is first to play[\\s\\S]*" +
      "a's hand: K♣,K♥, totaling 20;\\s+testbot's hand: K♦,K♠, totaling 20\\.[\\s\\S]*" +
      "testbot pulls a Q♦, totaling 30 - they busted!\\s+" +
      "The winner is a;\\s+a won 10 points and now has 110 points"
  )
);
testHandler(aChatContext, "!budget", /The casino has -10 points$/);

// bot duel: test winning
myDeck.cards = [
  new Card(12, CardSuit.Club),
  new Card(2, CardSuit.Diamond),

  new Card(9, CardSuit.Heart),
  new Card(9, CardSuit.Spade),

  new Card(9, CardSuit.Club),
  new Card(9, CardSuit.Diamond),
];
setBalanceNoReserved(userData, "a", 100);
setBalanceNoReserved(userData, "testbot", 0);
moves = [Moves.Stand, Moves.Hit];
testHandler(
  aChatContext,
  "!duel 10 testbot",
  new RegExp(
    "I accept! Let the blackjack duel begin[\\s\\S]*" +
      "a's hand: 9♠,9♥, totaling 18;\\s+testbot's hand: 9♦,9♣, totaling 18\\.[\\s\\S]*" +
      "testbot pulls a 2♦, totaling 20!\\s+testbot stands with 20\\.[\\s\\S]*a, your move"
  )
);
testHandler(
  aChatContext,
  "!balance",
  /You have 100 points \(currently betted 10 of those\), a!/
);
testHandler(
  aChatContext,
  "!check",
  /a's hand: 9♠,9♥, totaling 18;\s+testbot's hand: 9♦,9♣,2♦, totaling 20.[\s\S]*a, your move!/
);
// also check that bot rejects other duelists now
testHandler(bChatContext, "!duel 10 testbot", /b, I'm already playing with a/);
testHandler(
  aChatContext,
  "!hit",
  /Q♣, totaling 28 - they busted! The winner is testbot;\s+a lost 10 points and now has 90 points/
);
testHandler(aChatContext, "!balance", /You have 90 points, a!/);
testHandler(aChatContext, "!budget", /The casino has 10 points/);
testHandler(bChatContext, "!unduel", /b retracted/);

// bot duel: test resignation
myDeck.cards = new Deck().cards;
setBalanceNoReserved(userData, "a", 100);
setBalanceNoReserved(userData, "testbot", 0);
moves = [];
testHandler(
  aChatContext,
  "!duel 10 testbot",
  new RegExp(
    "I accept! Let the blackjack duel begin!\ntestbot is first to play[\\s\\S]*" +
      "a's hand: K♣,K♥, totaling 20;\\s+testbot's hand: K♦,K♠, totaling 20\\.[\\s\\S]*" +
      "testbot forfeits the blackjack duel\\. " +
      "The winner is a;\\s+a won 10 points and now has 110 points"
  )
);
testHandler(aChatContext, "!budget", /The casino has -10 points$/);

// test multiple duel types
myDeck.cards = new Deck().cards;
instance = createTestBot(
  [
    new DuelBot({
      ...config,
      playerShuffleChance: 0,
      duelImpls: {
        bj: new BlackJackDuelImpl({
          deckGenerator: () => myDeck,
          gameBrain: new BlackJackBrain(0),
        }), // use this deck interface and don't shuffle players
        testduelname: new TestDuelImpl(),
      },
    }),
  ],
  config
);
setBalanceNoReserved(userData, "a", 100);
setBalanceNoReserved(userData, "b", 100);
setBalanceNoReserved(userData, "c", 100);
setBalanceNoReserved(userData, "d", 100);
testHandler(
  bChatContext,
  "!duel 10 a",
  /a, reply with !accept \[b\] to accept the blackjack duel, if you're ready to bet 10 points!/
);
testHandler(cChatContext, "!accept b", /b didn't request a duel with you/);
testHandler(
  cChatContext,
  "!duel 10 d testduelname",
  /d, reply with !accept \[c\] to accept the test duel, if you're ready to bet 10 points!/
);
testHandler(
  aChatContext,
  "!accept",
  /Let the blackjack duel begin[\s\S]*b's hand: K♦,K♠, totaling 20;\s+a's hand: K♣,K♥, totaling 20\.[\s\S]*b, your move!/
);
testHandler(
  bChatContext,
  "!accept",
  /b, you already have a blackjack duel in progress with a/
);
testHandler(
  aChatContext,
  "!accept",
  /a, you already have a blackjack duel in progress with b/
);
testHandler(
  dChatContext,
  "!accept",
  /Let the test duel begin[\s\S]*test duel prompt/
);
testHandler(
  cChatContext,
  "!accept",
  /c, you already have a test duel in progress with d/
);
testHandler(
  aChatContext,
  "!rendezvous",
  /a, you are participating in: an ongoing blackjack duel b <-> a$/
);
testHandler(
  bChatContext,
  "!rendezvous",
  /b, you are participating in: an ongoing blackjack duel b <-> a$/
);
testHandler(
  cChatContext,
  "!rendezvous",
  /c, you are participating in: an ongoing test duel c <-> d$/
);
testHandler(
  dChatContext,
  "!rendezvous",
  /d, you are participating in: an ongoing test duel c <-> d$/
);
testHandler(
  aChatContext,
  "!check",
  /b's hand: K♦,K♠, totaling 20;\s+a's hand: K♣,K♥, totaling 20\.[\s\S]*b, your move!/
);
testHandler(
  bChatContext,
  "!check",
  /b's hand: K♦,K♠, totaling 20;\s+a's hand: K♣,K♥, totaling 20\.[\s\S]*b, your move!/
);
testHandler(cChatContext, "!check", /test duel status/);
testHandler(dChatContext, "!check", /test duel status/);
testHandler(
  aChatContext,
  "!balance",
  /You have 100 points \(currently betted 10 of those\), a!/
);
testHandler(
  bChatContext,
  "!balance",
  /You have 100 points \(currently betted 10 of those\), b!/
);
testHandler(
  cChatContext,
  "!balance",
  /You have 100 points \(currently betted 10 of those\), c!/
);
testHandler(
  dChatContext,
  "!balance",
  /You have 100 points \(currently betted 10 of those\), d!/
);
testHandler(bChatContext, "!duel 10 c", /Duel already in progress/);
testHandler(aChatContext, "!duel 10 c", /Duel already in progress/);
testHandler(cChatContext, "!stand", /not in a blackjack duel/);
testHandler(aChatContext, "!stand", /it's not your turn/);
testHandler(bChatContext, "!stand", /a, your move/);
testHandler(cChatContext, "!nop", /test duel prompt/);
testHandler(dChatContext, "!nop", /test duel prompt/);
testHandler(bChatContext, "!hit", /it's not your turn/);
testHandler(aChatContext, "!stand", /a tie/);
testHandler(aChatContext, "!balance", /You have 100 points, a!/);
testHandler(bChatContext, "!balance", /You have 100 points, b!/);
testHandler(cChatContext, "!nop", /test duel prompt/);
testHandler(dChatContext, "!nop", /test duel prompt/);
testHandler(aChatContext, "!check", /duel result was: you tied with b/);
testHandler(bChatContext, "!check", /duel result was: you tied with a/);
testHandler(cChatContext, "!nop", /test duel prompt/);
testHandler(dChatContext, "!nop", /test duel prompt/);

// regression test
myDeck.cards = [
  new Card(1, CardSuit.Club),
  new Card(1, CardSuit.Spade),

  new Card(9, CardSuit.Club),
  new Card(10, CardSuit.Club),

  new Card(12, CardSuit.Spade),
  new Card(6, CardSuit.Club),
  new Card(5, CardSuit.Heart),
].reverse();
setBalanceNoReserved(userData, "a", 270);
setBalanceNoReserved(userData, "b", 10123);
testHandler(
  bChatContext,
  "!duel 1000 a",
  /a, reply with !accept \[b\] to accept the blackjack duel, if you're ready to bet 1000 points!/
);
testHandler(
  aChatContext,
  "!accept",
  /Let the blackjack duel begin[\s\S]*b's hand: A♣,A♠, totaling 12;\s+a's hand: 9♣,10♣, totaling 19\.[\s\S]*b, your move!/
);
testHandler(
  aChatContext,
  "!balance",
  /You have 270 points \(currently betted 270 of those\), a!/
);
testHandler(
  bChatContext,
  "!balance",
  /You have 10123 points \(currently betted 1000 of those\), b!/
);
testHandler(bChatContext, "!hit", /b pulls a Q♠, totaling 12! b, your move!/);
testHandler(bChatContext, "!hit", /b pulls a 6♣, totaling 18! b, your move!/);
testHandler(
  bChatContext,
  "!hit",
  /b pulls a 5♥, totaling 23 - they busted! The winner is a;\s+b lost 1000 points and now has 9123 points;\s+a won 1000 points and now has 1270 points/
);
testHandler(aChatContext, "!balance", /You have 1270 points, a!/);
testHandler(bChatContext, "!balance", /You have 9123 points, b!/);
testHandler(aChatContext, "!check", /duel result was: you won against b/);
testHandler(bChatContext, "!check", /duel result was: you lost to a/);

/*
 * test anagrams
 */
{
  let counter = 0;
  let anagrams = {
    longword: ["lordwong"],
    lordwong: ["longword"],
    ab: ["ba"],
    ba: ["ab"],
  };
  let words = ["longword", "lordwong", "ab", "ba"];
  function randomizer() {
    return (
      Object.keys(anagrams).indexOf(words[counter++]) /
      Object.keys(anagrams).length
    );
  }
  instance = createTestBot(
    [
      new DuelBot({
        ...config,
        playerShuffleChance: 1,
        duelImpls: {
          anagrams: new AnagramsDuelImpl({
            anagrams: JSON.stringify(anagrams),
            anagramsIsFile: false,
            numToGuess: 4,
            gameBrain: undefined,
            randomizer: randomizer,
          }),
        },
      }),
    ],
    config
  );

  setBalanceNoReserved(userData, "a", 100);
  setBalanceNoReserved(userData, "b", 100);

  testHandler(aChatContext, "!duels", /List of duel types: anagrams/);
  testHandler(aChatContext, "!duel 10 b aaa", /aaa is not a valid duel/);
  testHandler(
    aChatContext,
    "!duel 10 b anagrams",
    /b, reply with !accept \[a\] to accept the anagrams duel, if you're ready to bet 10 points!/
  );
  testHandler(
    bChatContext,
    "!accept",
    /Let the anagrams duel begin[\s\S]*These words are left: longword, lordwong, ab, ba./
  );
  testHandler(
    bChatContext,
    "!hint longword",
    /Hint: an answer for longword looks like l______g!/
  );
  testHandler(
    bChatContext,
    "!hint longword",
    /Hint: an answer for longword looks like l__d___g!/
  );
  testHandler(
    bChatContext,
    "!hint longword",
    /Hint: an answer for longword looks like l__dw__g!/
  );
  testHandler(
    bChatContext,
    "!hint longword",
    /Hint: an answer for longword looks like l__dw__g!/
  );
  testHandler(
    bChatContext,
    "!hint lordwong",
    /Hint: an answer for lordwong looks like l______d!/
  );
  testHandler(
    bChatContext,
    "!hint lordwong",
    /Hint: an answer for lordwong looks like l__g___d!/
  );
  testHandler(
    bChatContext,
    "!hint lordwong",
    /Hint: an answer for lordwong looks like l__gw__d!/
  );
  testHandler(
    bChatContext,
    "!hint lordwong",
    /Hint: an answer for lordwong looks like l__gw__d!/
  );
  testHandler(
    aChatContext,
    "!an longword",
    /a guessed lordwong; they now have 1 points! These words are left: longword, ab, ba./
  );
  testHandler(
    aChatContext,
    "!an ab",
    /a guessed ba; they now have 2 points! These words are left: longword, ab./
  );
  testHandler(
    bChatContext,
    "!an lordwong",
    /b guessed longword; they now have 1 points! These words are left: ab./
  );
  testHandler(
    aChatContext,
    "!an lordwong",
    /a did not guess any anagrams; they still have 2 points! These words are left: ab./
  );
  testHandler(
    aChatContext,
    "!an ba",
    /a guessed ab; they now have 3 points! The winner is a;[\s\S*]a won 10 points and now has 110 points;[\s\S*]b lost 10 points and now has 90 points/
  );
}

/*
 * test wordle
 */
{
  let counter = 0;
  let validGuesses = ["crane", "plane", "enarc"];
  function randomizer() {
    counter = counter % validGuesses.length;
    return counter++ / validGuesses.length;
  }
  instance = createTestBot(
    [
      new DuelBot({
        ...config,
        playerShuffleChance: 1,
        duelImpls: {
          wordle: new WordleDuelImpl({
            validWordleGuesses: JSON.stringify(validGuesses),
            validWordleTargets: JSON.stringify(validGuesses),
            validWordleDataIsFile: false,
            gameBrain: new DoNothingBrain(0.1),
            randomizer: randomizer,
          }),
        },
      }),
    ],
    config
  );

  setBalanceNoReserved(userData, "a", 100);
  setBalanceNoReserved(userData, "b", 100);

  testHandler(aChatContext, "!duels", /List of duel types: wordle/);
  testHandler(aChatContext, "!duel 10 b aaa", /aaa is not a valid duel/);
  testHandler(
    aChatContext,
    "!duel 10 b wordle",
    /b, reply with !accept \[a\] to accept the wordle duel, if you're ready to bet 10 points!/
  );
  testHandler(bChatContext, "!accept", /Let the wordle duel begin/);
  testHandler(aChatContext, "!wo plane", /a guessed: PL🅰🅽🅴/);
  testHandler(aChatContext, "!wo aaaaa", /Not a word/);
  testHandler(bChatContext, "!wo enarc", /b guessed: 🄔🄝🅰🄡🄒/);
  testHandler(
    aChatContext,
    "!wo crane",
    /a guessed: 🅲🆁🅰🅽🅴! The winner is a;[\s\S*]a won 10 points and now has 110 points;[\s\S*]b lost 10 points and now has 90 points/
  );
}

// test wordle against bot
{
  let counter = 0;
  let validGuesses = ["crane", "plane", "enarc"];
  function randomizer() {
    return 0;
  }
  instance = createTestBot(
    [
      new DuelBot({
        ...config,
        playerShuffleChance: 1,
        duelImpls: {
          wordle: new WordleDuelImpl({
            validWordleGuesses: JSON.stringify(validGuesses),
            validWordleTargets: JSON.stringify(validGuesses),
            validWordleDataIsFile: false,
            gameBrain: new DoNothingBrain(0.0),
            randomizer: randomizer,
          }),
        },
      }),
    ],
    config
  );

  setBalanceNoReserved(userData, "a", 100);
  setBalanceNoReserved(userData, "testbot", 100);

  testHandler(aChatContext, "!duels", /List of duel types: wordle/);
  testHandler(aChatContext, "!duel 10 testbot wordle", /I accept!/);
  testHandler(aChatContext, "!wo plane", /a guessed: PL🅰🅽🅴/);
  testHandler(aChatContext, "!wo aaaaa", /Not a word/);
  testHandler(bChatContext, "!wo enarc", /b, you're not in a duel!/);
  testHandler(aChatContext, "!wo enarc", /a guessed: 🄔🄝🅰🄡🄒/);
  testHandler(
    aChatContext,
    "!wo crane",
    /a guessed: 🅲🆁🅰🅽🅴! The winner is a;[\s\S*]a won 10 points and now has 110 points/
  );
  testHandler(aChatContext, "!budget", /The casino has 90 points/);

  setBalanceNoReserved(userData, "a", 100);
  setBalanceNoReserved(userData, "testbot", 100);

  testHandler(aChatContext, "!duels", /List of duel types: wordle/);
  testHandler(aChatContext, "!duel 10 testbot wordle", /I accept!/);
  for (let i = 0; i < 5; i++) {
    testHandler(aChatContext, "!wo plane", /a guessed: PL🅰🅽🅴/);
  }
  testHandler(
    aChatContext,
    "!wo enarc",
    /You have 0 guesses left. The winner is testbot;\s+a lost 10 points and now has 90 points/
  );
  testHandler(aChatContext, "!budget", /The casino has 110 points/);
}
