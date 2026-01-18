import assert from "assert";
import { ChatContext, selectHandler } from "../../src/util/interfaces";
import {
  createTestBot,
  createTestBotConfig,
  instanceTestHandler,
  setBalanceNoReserved,
} from "./utils";
import { PredefinedHandler } from "../../src/bot/botbase";

// Test the bot itself
const config = createTestBotConfig();
const userData = config.userData;
const instance = createTestBot([], config);
const testChatContext = { username: "test", "user-id": "test", mod: false };

function testHandler(context: ChatContext, command: string, expected: RegExp) {
  return instanceTestHandler(instance, context, command, expected);
}

// test initial balance
testHandler(testChatContext, "!balance", /You have 100 points/);
setBalanceNoReserved(userData, config.botContext.botUsername, 200);
testHandler(testChatContext, "!budget", /casino has 200 points/);

// test claims
testHandler(testChatContext, "!claime", /claimed 100 points/);
testHandler(testChatContext, "!balance", /You have 200 points/);
// assume that 30 minutes do not pass between these statements
testHandler(testChatContext, "!claime", /on cooldown/);
for (let i = 0; i < 10; i++) {
  userData.get("test").lastClaim = undefined;
  setBalanceNoReserved(userData, "test", 1000);
  testHandler(
    testChatContext,
    "!claime 100",
    new RegExp(
      "(You halved your balance! You claimed -500 points)|" +
        "(You doubled your balance! You claimed 1000 points)"
    )
  );
}

// test leaderboard
setBalanceNoReserved(userData, "test", 100);
setBalanceNoReserved(userData, "test1", 200);
setBalanceNoReserved(userData, "test2", 300);
// remember new usernames
testHandler(
  { username: "test1", "user-id": "test1", mod: false },
  "!balance",
  /You have 200 points/
);
testHandler(
  { username: "test2", "user-id": "test2", mod: false },
  "!balance",
  /You have 300 points/
);
testHandler(testChatContext, "!balance", /You have 100 points/);
testHandler(
  testChatContext,
  "!leaderboard",
  /Top 3 richest people in our chat: test2 with 300 points;\s+test1 with 200 points;\s+test with 100 points/
);
testHandler(
  testChatContext,
  "!leaderboard 2",
  /Top 2 richest people in our chat: test2 with 300 points;\s+test1 with 200 points/
);
testHandler(
  testChatContext,
  "!leaderboard 1",
  /Top 1 richest people in our chat: test2 with 300 points/
);
testHandler(testChatContext, "!leaderboard asda", /error/);

// check that balance manipulation methods are actually private
assert.strictEqual(
  selectHandler(instance, `!${PredefinedHandler.ReserveBalance} test 100`)
    ?.handler,
  undefined
);
assert.strictEqual(
  selectHandler(instance, `!${PredefinedHandler.UpdateBalance} test 100`)
    ?.handler,
  undefined
);
assert.strictEqual(
  selectHandler(instance, `!${PredefinedHandler.GetBalance} test`)?.handler,
  undefined
);
