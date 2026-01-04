import { ChatContext } from "../../src/util/interfaces";
import {
  createTestBot,
  createTestBotConfig,
  instanceTestHandler,
} from "./utils";
import { FrameBot } from "../../src/bot/framebot";

const config = createTestBotConfig();
const frameConfig = {
  ...config,
  filePath: "",
  overrides: JSON.stringify({
    frames: [
      { begin: "[", end: "]", price: 1 },
      { begin: "-=", end: "=-", price: 10 },
    ],
  }),
};
const instance = createTestBot([new FrameBot(frameConfig)], config);
const testChatContext = { username: "test", "user-id": "test", mod: false };

function testHandler(context: ChatContext, command: string, expected: RegExp) {
  return instanceTestHandler(instance, context, command, expected);
}

// no custom frame
testHandler(testChatContext, "!balance", /You have 100 points, test!/);
testHandler(
  testChatContext,
  "!frames",
  /0: \[test\] \(1 points\), 1: -=test=- \(10 points\)/
);

// test custom frame
testHandler(
  testChatContext,
  "!buyFrame 0",
  /\[test\] subscribed to a frame 0 for 1 points\/print!/
);
testHandler(testChatContext, "!balance", /You have 98 points, \[test\]!/);

// test another custom frame
testHandler(
  testChatContext,
  "!buyFrame 1",
  /-=test=- subscribed to a frame 1 for 10 points\/print!/
);
testHandler(testChatContext, "!balance", /You have 78 points, -=test=-!/);

// reset custom frame
testHandler(
  testChatContext,
  "!buyFrame -1",
  /test reset to no custom frame for free!/
);
testHandler(testChatContext, "!balance", /You have 78 points, test!/);
