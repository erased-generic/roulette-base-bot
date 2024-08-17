import { DuelCommand, DuelBot, DuelAccepted } from "../../src/bot/duelbot";
import { BlackJackDuelBot } from "../../src/bot/blackjackduelbot";
import {
  BotHandler,
  ChatContext,
  Game,
  GameBrain,
  GameMoveResult,
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
  createTestBotContext,
  createTestUserData,
  instanceTestHandler,
  instanceTestParser,
  setBalanceNoReserved,
} from "./utils";

function parse(args: string[]) {
  return DuelBot.parseDuelCommand(["", ...args]);
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
  getCurrentPlayer(): string {
    return this.players[0];
  }
  init(): GameResult | undefined {
    return undefined;
  }
  moveHandlers = {};
}

class TestDuelBot extends DuelBot<TestGame> {
  readonly handlers: { [key: string]: BotHandler } = {
    duel: {
      action: this.duelHandler.bind(this),
      description: "",
      format: "",
    },
    accept: {
      action: this.acceptHandler.bind(this),
      description: "",
      format: "",
    },
    unduel: {
      action: this.unduelHandler.bind(this),
      description: "",
      format: "",
    },
    rendezvous: {
      action: this.rendezvousHandler.bind(this),
      description: "",
      format: "",
    },
    check: {
      action: this.checkHandler.bind(this),
      description: "",
      format: "",
    },
  };

  protected printDuelIntro(duel: DuelAccepted<TestGame>): string {
    return "test duel intro";
  }
  protected printDuelStatus(
    duel: DuelAccepted<TestGame>,
    moreInfo: boolean
  ): string {
    return "test duel status";
  }
  protected printDuelPrompt(
    duel: DuelAccepted<TestGame>,
    moreInfo: boolean
  ): string {
    return "test duel prompt";
  }
  protected printDuelResult(
    duel: DuelAccepted<TestGame>,
    moreInfo: boolean,
    result: GameResult
  ): string {
    return "test duel result";
  }
  protected createDuelPayload(players: string[], args: string[]): TestGame {
    return new TestGame(players);
  }
}

// first, test rendezvous mechanism
const botContext = createTestBotContext();
const userData = botContext.userData;
const myDeck = new Deck();
let instance = createTestBot(
  [
    (ctx) => new TestDuelBot(ctx, 0, "test duel"), // use this deck interface and don't shuffle players
  ],
  botContext
);

testParser("100 aaa", {
  amount: 100,
  username: "aaa",
});
testParser("100 1212", {
  amount: 100,
  username: "1212",
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
testHandler(aChatContext, "!accept", /no one requested a test duel with you/);
testHandler(aChatContext, "!accept b", /b didn't request a test duel with you/);
testHandler(
  aChatContext,
  "!rendezvous",
  /a, you are participating in: no test duels or requests/
);
testHandler(
  bChatContext,
  "!rendezvous",
  /b, you are participating in: no test duels or requests/
);
testHandler(aChatContext, "!check", /a, you're not in a test duel/);
testHandler(bChatContext, "!check", /b, you're not in a test duel/);
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
testHandler(aChatContext, "!check", /a, you're not in a test duel/);
testHandler(bChatContext, "!check", /b, you're not in a test duel/);
testHandler(
  aChatContext,
  "!unduel",
  /a retracted all their test duel requests/
);
testHandler(
  bChatContext,
  "!unduel",
  /b retracted all their test duel requests/
);
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
testHandler(
  aChatContext,
  "!unduel",
  /a retracted all their test duel requests/
);
setBalanceNoReserved(userData, "a", 0);
testHandler(
  aChatContext,
  "!duel all b",
  /b, reply with !accept \[a\] to accept the test duel, if you're ready to bet 0 points!/
);

// test that you go all-in if you don't have enough points for accepting the duel
testHandler(
  aChatContext,
  "!unduel",
  /a retracted all their test duel requests/
);
setBalanceNoReserved(userData, "a", 10);
testHandler(
  bChatContext,
  "!duel 30 a",
  /a, reply with !accept \[b\] to accept the test duel, if you're ready to bet 30 points!/
);
testHandler(aChatContext, "!accept", /a is going all-in with 10 points!/);
testHandler(aChatContext, "!unduel", /a forfeits the test duel/);

// test an actual duel
myDeck.cards = new Deck().cards;
instance = createTestBot(
  [
    (u) => new BlackJackDuelBot(u, 0, () => myDeck, new BlackJackBrain(0)), // use this deck interface and don't shuffle players
  ],
  botContext
);
setBalanceNoReserved(userData, "a", 100);
setBalanceNoReserved(userData, "b", 100);
testHandler(
  bChatContext,
  "!duel 10 a",
  /a, reply with !accept \[b\] to accept the blackjack duel, if you're ready to bet 10 points!/
);
testHandler(
  cChatContext,
  "!accept b",
  /b didn't request a blackjack duel with you/
);
testHandler(
  aChatContext,
  "!accept",
  /Let the blackjack duel begin[\s\S]*b's hand: K♦,K♠, totaling 20;\s+a's hand: K♣,K♥, totaling 20\.\s+b, your move! Type !hit or !stand!/
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
  /b's hand: K♦,K♠, totaling 20;\s+a's hand: K♣,K♥, totaling 20\.\s+b, your move! Type !hit or !stand!/
);
testHandler(
  bChatContext,
  "!check",
  /b's hand: K♦,K♠, totaling 20;\s+a's hand: K♣,K♥, totaling 20\.\s+b, your move! Type !hit or !stand!/
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
  /Let the blackjack duel begin[\s\S]*b's hand: 9♦,9♣, totaling 18;\s+a's hand: 9♠,9♥, totaling 18\.\s+b, your move! Type !hit or !stand!/
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
testHandler(
  bChatContext,
  "!hit",
  /b pulls a 2♦, totaling 20! b, your move! Type !hit or !stand!/
);
testHandler(
  bChatContext,
  "!check",
  /b's hand: 9♦,9♣,2♦, totaling 20;\s+a's hand: 9♠,9♥, totaling 18\.\s+b, your move! Type !hit or !stand!/
);
testHandler(
  bChatContext,
  "!stand",
  /b stands with 20\.\s+a, your move! Type !hit or !stand!/
);
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
      "b's hand: 10♥,A♥, totaling 21;\\s+a's hand: 9♦,9♣, totaling 18.\\s+" +
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
  /Let the blackjack duel begin[\s\S]*b's hand: K♦,K♠, totaling 20;\s+a's hand: K♣,K♥, totaling 20\.\s+b, your move! Type !hit or !stand!/
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
    (u) =>
      new BlackJackDuelBot(
        botContext,
        1,
        () => {
          if (isFirst) {
            isFirst = false;
            return myDeck;
          } else {
            return myDeck2;
          }
        },
        new BlackJackBrain(0)
      ), // use different decks for the two duels, also swap players
  ],
  botContext
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
testHandler(
  dChatContext,
  "!accept b",
  /d, b didn't request a blackjack duel with you!/
);
testHandler(
  dChatContext,
  "!accept a",
  /d, a didn't request a blackjack duel with you!/
);
testHandler(
  aChatContext,
  "!accept d",
  /a, d didn't request a blackjack duel with you!/
);
testHandler(
  aChatContext,
  "!accept c",
  /a, c didn't request a blackjack duel with you!/
);
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
      "a's hand: 10♦,10♣, totaling 20.\\s+" +
      "a, your move! Type !hit or !stand!"
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
      "d's hand: 9♠,9♥, totaling 18.\\s+" +
      "d, your move! Type !hit or !stand!"
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
    (u) =>
      new BlackJackDuelBot(
        botContext,
        1,
        () => {
          return myDeck;
        },
        new BlackJackBrain(1)
      ),
  ],
  botContext
);
testHandler(
  aChatContext,
  "!duel all testbot",
  /maybe another time/
);

let moves = [];
const seqBrain = new (class implements GameBrain<BlackJack> {
  requestGame(
    userId: string,
    username: string,
    args: string[]
  ): { args: string[] } {
    return { args: [] };
  }
  move(game: BlackJack): { move: string; args: string[] } | undefined {
    if (moves.length === 0) {
      return undefined;
    }
    const move = moves.pop();
    return { move, args: [] };
  }
})();
myDeck.cards = new Deck().cards;
instance = createTestBot(
  [
    (u) =>
      new BlackJackDuelBot(
        botContext,
        1,
        () => {
          return myDeck;
        },
        seqBrain
      ),
  ],
  botContext
);
setBalanceNoReserved(userData, "a", 100);
setBalanceNoReserved(userData, "testbot", 0);
moves = [Moves.Hit];
testHandler(
  aChatContext,
  "!duel 10 testbot",
  new RegExp(
    "I accept! Let the blackjack duel begin, testbot is first to play[\\s\\S]*" +
      "a's hand: K♣,K♥, totaling 20;\\s+testbot's hand: K♦,K♠, totaling 20\\.\\s+" +
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
      "a's hand: 9♠,9♥, totaling 18;\\s+testbot's hand: 9♦,9♣, totaling 18\\.\\s+" +
      "testbot pulls a 2♦, totaling 20!\\s+testbot stands with 20\\.\\s+a, your move"
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
  /a's hand: 9♠,9♥, totaling 18;\s+testbot's hand: 9♦,9♣,2♦, totaling 20.\s+a, your move! Type !hit or !stand!/
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

// bot duel: test resignation
myDeck.cards = new Deck().cards;
setBalanceNoReserved(userData, "a", 100);
setBalanceNoReserved(userData, "testbot", 0);
moves = [];
testHandler(
  aChatContext,
  "!duel 10 testbot",
  new RegExp(
    "I accept! Let the blackjack duel begin, testbot is first to play[\\s\\S]*" +
      "a's hand: K♣,K♥, totaling 20;\\s+testbot's hand: K♦,K♠, totaling 20\\.\\s+" +
      "testbot forfeits the blackjack duel\\. " +
      "The winner is a;\\s+a won 10 points and now has 110 points"
  )
);
testHandler(aChatContext, "!budget", /The casino has -10 points$/);
