import { PredictCommand, PredictionBot } from '../../src/bot/predictionbot';
import { ChatContext } from '../../src/util/interfaces';
import { createTestBot, createTestBotContext, createTestUserData, instanceTestHandler, instanceTestParser, setBalanceNoReserved } from './utils';

function parse(instance: PredictionBot, args: string[]) {
  return PredictionBot.parsePredictCommand(["", ...args], instance.all_places);
}

function testParser(instance: PredictionBot, command: string, expected: PredictCommand | undefined) {
  return instanceTestParser(args => parse(instance, args), command, expected);
}

const botContext = createTestBotContext();
const userData = botContext.userData;
let predict_instance: PredictionBot;
const instance = createTestBot([
  ctx => predict_instance = new PredictionBot(ctx, 100)
], botContext);

testParser(predict_instance, "100 0", {
  predictNumber: 0,
  amount: 100
});
testParser(predict_instance, "100 1", {
  predictNumber: 1,
  amount: 100
});
testParser(predict_instance, "100 101", undefined);
testParser(predict_instance, "100 -1", undefined);
testParser(predict_instance, "100 1-2", undefined);
testParser(predict_instance, "100 1 2 3", undefined);

// Test the bot itself
const modChatContext = { username: "mod", 'user-id': "mod", mod: true };
const aChatContext = { username: "a", 'user-id': "a", mod: false };
const bChatContext = { username: "b", 'user-id': "b", mod: false };

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
  bChatContext,
  "!balance",
  /You have 100 points/
);

// test predictions interface
testHandler(
  modChatContext,
  "!open",
  /An honorable mod has opened a prediction/
);
testHandler(
  aChatContext,
  "!predict 100 1",
  /a predicted 1 with 100 points/
);
testHandler(
  aChatContext,
  "!predict 100 101",
  /error/
);
testHandler(
  aChatContext,
  "!predict 100 1 2 3",
  /error/
);
testHandler(
  aChatContext,
  "!predict 100 1-2",
  /error/
);
testHandler(
  aChatContext,
  "!predict lol 101",
  /error/
);
testHandler(
  aChatContext,
  "!predict lol lol",
  /error/
);
testHandler(
  aChatContext,
  "!predict 1000 1",
  /You don't have that many points/
);
testHandler(
  aChatContext,
  "!predict -1000 1",
  /You can bet only a positive amount of points/
);
testHandler(
  aChatContext,
  "!unpredict",
  /not predicting anymore/
);
testHandler(
  modChatContext,
  "!outcome 1",
  /Closing the prediction\. Prediction resulted in outcome '1'/
);
testHandler(
  modChatContext,
  "!open",
  /An honorable mod has opened a prediction/
);
testHandler(
  modChatContext,
  "!close",
  /An honorable mod has closed the prediction/
);
testHandler(
  modChatContext,
  "!outcome 1",
  /Prediction resulted in outcome '1'/
);

// test that non-mods can't open or close predictions
testHandler(
  aChatContext,
  "!open",
  /Peasant a, you can't open predictions!/
);
testHandler(
  aChatContext,
  "!close",
  /Peasant a, you can't close predictions!/
);

// test that you can't predict when predictions are closed
testHandler(
  aChatContext,
  "!predict 100 1",
  /Predictions are closed/
);

// test that we can predict all-in even if we have 0 points
testHandler(
  modChatContext,
  "!open",
  /An honorable mod has opened a prediction/
);
setBalanceNoReserved(userData, "a", 0);
testHandler(
  aChatContext,
  "!predict all 1",
  /a predicted 1 with 0 points/
);
testHandler(
  aChatContext,
  "!unpredict",
  /not predicting anymore/
);

// test that predictions overwrite each other
setBalanceNoReserved(userData, "a", 100);
testHandler(
  aChatContext,
  "!predict 100 1",
  /a predicted 1 with 100 points/
);
testHandler(
  aChatContext,
  "!balance",
  /You have 100 points \(currently betted 100 of those\)/
);
testHandler(
  aChatContext,
  "!predict 10 2",
  /a predicted 2 with 10 points/
);
testHandler(
  aChatContext,
  "!balance",
  /You have 100 points \(currently betted 10 of those\)/
);
testHandler(
  aChatContext,
  "!unpredict",
  /not predicting anymore/
);
testHandler(
  aChatContext,
  "!balance",
  /You have 100 points,/
);

// test balance updates
testHandler(
  aChatContext,
  "!predict 10 1",
  /a predicted 1 with 10 points/
);
testHandler(
  bChatContext,
  "!predict 50 2",
  /b predicted 2 with 50 points/
);
testHandler(
  aChatContext,
  "!balance",
  /You have 100 points \(currently betted 10 of those\),/
);
testHandler(
  bChatContext,
  "!balance",
  /You have 100 points \(currently betted 50 of those\),/
);
testHandler(
  modChatContext,
  "!outcome 1",
  new RegExp(
    "Closing the prediction\\. " +
    "Prediction resulted in outcome '1', " +
    "a won 50 points \\(coef 5x\\) and now has 150 points, " +
    "b lost 50 points \\(coef 0\\.2x\\) and now has 50 points"
  )
);
testHandler(
  aChatContext,
  "!balance",
  /You have 150 points,/
);
testHandler(
  bChatContext,
  "!balance",
  /You have 50 points,/
);

// test 0-point winning
setBalanceNoReserved(userData, "a", 100);
setBalanceNoReserved(userData, "b", 0);
testHandler(
  modChatContext,
  "!open",
  /An honorable mod has opened a prediction/
);
testHandler(
  aChatContext,
  "!predict 100 1",
  /a predicted 1 with 100 points/
);
testHandler(
  bChatContext,
  "!predict all 2",
  /b predicted 2 with 0 points/
);
testHandler(
  aChatContext,
  "!balance",
  /You have 100 points \(currently betted 100 of those\),/
);
testHandler(
  bChatContext,
  "!balance",
  /You have 0 points,/
);
testHandler(
  modChatContext,
  "!outcome 2",
  new RegExp(
    "Closing the prediction\\. " +
    "Prediction resulted in outcome '2', " +
    "a lost 100 points \\(coef 0x\\) and now has 0 points, " +
    "b won 100 points \\(coef Infinityx\\) and now has 100 points"
  )
);
testHandler(
  aChatContext,
  "!balance",
  /You have 0 points,/
);
testHandler(
  bChatContext,
  "!balance",
  /You have 100 points,/
);
