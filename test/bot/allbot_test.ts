import { RouletteBot } from '../../src/bot/roulettebot';
import { PredictionBot } from '../../src/bot/predictionbot';
import { ChatContext } from '../../src/util/interfaces';
import { createTestBot, createTestBotContext, createTestUserData, instanceTestHandler, setBalanceNoReserved } from './utils';
import { BlackJackDuelBot } from '../../src/bot/blackjackduelbot';
import { BlackJackBrain } from '../../src/util/blackjack';

const botContext = createTestBotContext();
let instance = createTestBot(
  [
    (ctx) => new RouletteBot(ctx),
    (ctx) => new PredictionBot(ctx, 100),
    (ctx) =>
      new BlackJackDuelBot(
        ctx,
        0.5,
        BlackJackDuelBot.shuffledDeckGenerator,
        new BlackJackBrain(0)
      ),
  ],
  botContext
);

// Test the bot interactions
const aChatContext = { username: "a", 'user-id': "a", mod: false };
const modChatContext = { username: "mod", 'user-id': "mod", mod: true };

function testHandler(context: ChatContext, command: string, expected: RegExp) {
  return instanceTestHandler(instance, context, command, expected);
}

// ensure initial balance
testHandler(
  aChatContext,
  "!balance",
  /You have 100 points/
);
testHandler(
  modChatContext,
  "!balance",
  /You have 100 points/
);

// test reserved balance interactions
testHandler(
  aChatContext,
  "!bet 10 red",
  /placed a bet of 10 on red/
)
testHandler(
  aChatContext,
  "!balance",
  /You have 100 points \(currently betted 10 of those\), a/
);
testHandler(
  modChatContext,
  "!open",
  /An honorable mod has opened a prediction/
);
testHandler(
  modChatContext,
  "!predict 50 0",
  /mod predicted 0 with 50 points/
);
testHandler(
  aChatContext,
  "!predict 100 1",
  /You don't have that many points/
);
testHandler(
  aChatContext,
  "!predict 20 1",
  /a predicted 1 with 20 points/
);
testHandler(
  aChatContext,
  "!balance",
  /You have 100 points \(currently betted 30 of those\), a/
);
testHandler(
  aChatContext,
  "!duel 10 mod",
  /mod, reply with !accept \[a\] to accept the blackjack duel, if you're ready to bet 10 points!/
);
testHandler(
  aChatContext,
  "!duel all mod",
  /mod, reply with !accept \[a\] to accept the blackjack duel, if you're ready to bet 70 points!/
);
testHandler(
  aChatContext,
  "!balance",
  /You have 100 points \(currently betted 100 of those\), a/
);
testHandler(
  modChatContext,
  "!outcome 1",
  new RegExp(
    "Closing the prediction\\. Prediction resulted in outcome '1', " +
    "mod lost 50 points \\(coef 0\\.4x\\) and now has 50 points, " +
    "a won 50 points \\(coef 2\\.5x\\) and now has 150 points"
  )
);
testHandler(
  aChatContext,
  "!balance",
  /You have 150 points \(currently betted 80 of those\), a/
);
testHandler(
  aChatContext,
  "!duel all mod",
  /mod, reply with !accept \[a\] to accept the blackjack duel, if you're ready to bet 140 points!/
);
