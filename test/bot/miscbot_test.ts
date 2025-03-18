import { MiscBot } from "../../src/bot/miscbot";
import { ChatContext } from "../../src/util/interfaces";
import {
  createTestBot,
  createTestBotContext,
  instanceTestHandler,
  setBalanceNoReserved,
} from "./utils";

// Test the bot itself
const botContext = createTestBotContext();
const userData = botContext.userData;
const instance = createTestBot(
  [
    (ctx) => new MiscBot(ctx),
  ],
  botContext
);
const testChatContext = { username: "test", "user-id": "test", mod: false };

function testHandler(context: ChatContext, command: string, expected: RegExp) {
  return instanceTestHandler(instance, context, command, expected);
}

setBalanceNoReserved(userData, "test", 10);
testHandler(
  testChatContext,
  "!balance",
  /You have 10 points/
);
testHandler(testChatContext, "!ping", /pong/);
testHandler(
  testChatContext,
  "!balance",
  /You have 9 points/
);

setBalanceNoReserved(userData, "test", 0);
testHandler(testChatContext, "!ping", /don't have that many points/);
testHandler(
  testChatContext,
  "!balance",
  /You have 0 points/
);
