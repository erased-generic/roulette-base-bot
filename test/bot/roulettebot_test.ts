import { BetCommand, RouletteBot } from "../../src/bot/roulettebot";
import { ChatContext } from "../../src/util/interfaces";
import {
  createTestBot,
  createTestBotConfig,
  instanceTestHandler,
  instanceTestParser,
  setBalanceNoReserved,
} from "./utils";
import * as assert from "assert";

function parse(args: string[]) {
  return RouletteBot.parseBetCommand(["", ...args]);
}

function testParser(command: string, expected: BetCommand | undefined) {
  return instanceTestParser(parse, command, expected);
}

testParser("100 0", {
  betNumbers: [0],
  betName: "0",
  amount: 100,
});
testParser("100 1", {
  betNumbers: [1],
  betName: "1",
  amount: 100,
});
testParser("100 30", {
  betNumbers: [30],
  betName: "30",
  amount: 100,
});
testParser("100 36", {
  betNumbers: [36],
  betName: "36",
  amount: 100,
});

testParser("100 red", {
  betNumbers: [
    1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
  ],
  betName: "red",
  amount: 100,
});

testParser("200 black", {
  betNumbers: [
    2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35,
  ],
  betName: "black",
  amount: 200,
});

testParser("300 green", {
  betNumbers: [0],
  betName: "green",
  amount: 300,
});

testParser("100 1 2", {
  betNumbers: [1, 2],
  betName: "custom bet",
  amount: 100,
});
testParser("100 2 3", {
  betNumbers: [2, 3],
  betName: "custom bet",
  amount: 100,
});
testParser("100 4 5", {
  betNumbers: [4, 5],
  betName: "custom bet",
  amount: 100,
});
testParser("100 26 27", {
  betNumbers: [26, 27],
  betName: "custom bet",
  amount: 100,
});
testParser("100 35 36", {
  betNumbers: [35, 36],
  betName: "custom bet",
  amount: 100,
});
testParser("100 36 37", undefined);
testParser("100 -1 2", undefined);
testParser("100 2--1 3", undefined);
testParser("100 1-0 3", undefined);
testParser("100 1 4", {
  betNumbers: [1, 4],
  betName: "custom bet",
  amount: 100,
});
testParser("100 2 5", {
  betNumbers: [2, 5],
  betName: "custom bet",
  amount: 100,
});
testParser("100 5 2", {
  betNumbers: [2, 5],
  betName: "custom bet",
  amount: 100,
});
testParser("100 3 6", {
  betNumbers: [3, 6],
  betName: "custom bet",
  amount: 100,
});
testParser("100 33 36", {
  betNumbers: [33, 36],
  betName: "custom bet",
  amount: 100,
});

testParser("100 1 2 3", {
  betNumbers: [1, 2, 3],
  betName: "custom bet",
  amount: 100,
});
testParser("100 4 5 6", {
  betNumbers: [4, 5, 6],
  betName: "custom bet",
  amount: 100,
});
testParser("100 31 32 33", {
  betNumbers: [31, 32, 33],
  betName: "custom bet",
  amount: 100,
});

testParser("100 1 2 4 5", {
  betNumbers: [1, 2, 4, 5],
  betName: "custom bet",
  amount: 100,
});
testParser("100 5 4 2 1", {
  betNumbers: [1, 2, 4, 5],
  betName: "custom bet",
  amount: 100,
});
testParser("100 17 18 20 21", {
  betNumbers: [17, 18, 20, 21],
  betName: "custom bet",
  amount: 100,
});
testParser("100 32 33 35 36", {
  betNumbers: [32, 33, 35, 36],
  betName: "custom bet",
  amount: 100,
});

testParser("100 1 2 3 4 5 6", {
  betNumbers: [1, 2, 3, 4, 5, 6],
  betName: "custom bet",
  amount: 100,
});
testParser("100 4 5 6 7 8 9", {
  betNumbers: [4, 5, 6, 7, 8, 9],
  betName: "custom bet",
  amount: 100,
});
testParser("100 7 8 9 4 5 6", {
  betNumbers: [4, 5, 6, 7, 8, 9],
  betName: "custom bet",
  amount: 100,
});
testParser("100 31 32 33 34 35 36", {
  betNumbers: [31, 32, 33, 34, 35, 36],
  betName: "custom bet",
  amount: 100,
});

testParser("100 column1", {
  betNumbers: [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
  betName: "column1",
  amount: 100,
});

testParser("100 column2", {
  betNumbers: [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  betName: "column2",
  amount: 100,
});

testParser("100 column3", {
  betNumbers: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  betName: "column3",
  amount: 100,
});

testParser("100 dozen1", {
  betNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  betName: "dozen1",
  amount: 100,
});

testParser("100 dozen2", {
  betNumbers: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
  betName: "dozen2",
  amount: 100,
});

testParser("100 dozen3", {
  betNumbers: [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],
  betName: "dozen3",
  amount: 100,
});

testParser("100 odd", {
  betNumbers: [
    1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35,
  ],
  betName: "odd",
  amount: 100,
});

testParser("100 even", {
  betNumbers: [
    2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36,
  ],
  betName: "even",
  amount: 100,
});

testParser("100 1to18", {
  betNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
  betName: "1to18",
  amount: 100,
});

testParser("100 19to36", {
  betNumbers: [
    19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
  ],
  betName: "19to36",
  amount: 100,
});

testParser("100 all", {
  betNumbers: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
  ],
  betName: "all",
  amount: 100,
});

testParser("100 all0", {
  betNumbers: [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
  ],
  betName: "all0",
  amount: 100,
});

testParser("100 0-36", {
  betNumbers: [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
  ],
  betName: "custom bet",
  amount: 100,
});

// Test the bot itself
const config = createTestBotConfig();
const userData = config.botContext.userData;
const instance = createTestBot([new RouletteBot(config)], config);
const testChatContext = { username: "test", "user-id": "test", mod: false };

function testHandler(
  context: ChatContext,
  command: string,
  expected: RegExp
): string {
  return instanceTestHandler(instance, context, command, expected);
}

// test initial balance
testHandler(testChatContext, "!balance", /You have 100 points/);

// test bets interface
testHandler(testChatContext, "!bet 100 red", /placed a bet of 100 on red/);
testHandler(testChatContext, "!bet 100 1", /placed a bet of 100 on 1/);
testHandler(
  testChatContext,
  "!bet 100 1 2 3",
  /placed a bet of 100 on custom bet/
);
testHandler(testChatContext, "!bet 100 lol", /error/);
testHandler(testChatContext, "!bet lol lol", /error/);
testHandler(testChatContext, "!bet 1000 1", /You don't have that many points/);
testHandler(
  testChatContext,
  "!bet -1000 1",
  /You can bet only a positive amount of points/
);
testHandler(testChatContext, "!unbet", /not betting anymore/);
testHandler(testChatContext, "!roulette", /Ball landed on:/);

// test that we can bet all even if we have 0 points
setBalanceNoReserved(userData, "test", 0);
testHandler(testChatContext, "!bet all even", /placed a bet of 0 on even/);
testHandler(testChatContext, "!unbet", /not betting anymore/);

// test that bets overwrite each other
setBalanceNoReserved(userData, "test", 100);
testHandler(testChatContext, "!bet 100 odd", /placed a bet of 100 on odd/);
testHandler(
  testChatContext,
  "!balance",
  /You have 100 points \(currently betted 100 of those\)/
);
testHandler(testChatContext, "!bet 10 even", /placed a bet of 10 on even/);
testHandler(
  testChatContext,
  "!balance",
  /You have 100 points \(currently betted 10 of those\)/
);
testHandler(testChatContext, "!unbet", /not betting anymore/);

// can't seed default random generator :(
for (let i = 0; i < 10; i++) {
  testHandler(testChatContext, "!bet all odd", /placed a bet of \d+ on odd/);
  testHandler(
    testChatContext,
    "!roulette",
    /Ball landed on: (\d*[13579], test won \d+ points)|(\d*[02468], test lost \d+ points)/
  );
}

// test balance changes
setBalanceNoReserved(userData, "test", 100);
testHandler(testChatContext, "!bet 50 odd", /placed a bet of 50 on odd/);
testHandler(
  testChatContext,
  "!balance",
  /You have 100 points \(currently betted 50 of those\)/
);
testHandler(testChatContext, "!unbet", /not betting anymore/);
testHandler(testChatContext, "!balance", /You have 100 points,/);
for (let i = 0; i < 10; i++) {
  setBalanceNoReserved(userData, "test", 100);
  setBalanceNoReserved(userData, config.botContext.botUsername, 0);
  testHandler(testChatContext, "!bet 50 odd", /placed a bet of 50 on odd/);
  const msg = testHandler(
    testChatContext,
    "!roulette",
    new RegExp(
      "Ball landed on: " +
        "(\\d*[13579], test won 50 points with a chance of \\d+% and now has 150 points)|" +
        "(\\d*[02468], test lost 50 points with a chance of \\d+% and now has 50 points)"
    )
  );
  if (msg.match(/won 50/)) {
    testHandler(testChatContext, "!budget", /casino has -50 points/);
  } else {
    testHandler(testChatContext, "!budget", /casino has 50 points/);
  }
}

for (let i = 0; i < 10; i++) {
  userData.get("test").lastClaim = undefined;
  setBalanceNoReserved(userData, "test", 1000);
  testHandler(testChatContext, "!bet 500 odd", /placed a bet of 500 on odd/);
  testHandler(
    testChatContext,
    "!claime 100",
    new RegExp(
      "(You halved your balance! You claimed -250 points)|" +
        "(You doubled your balance! You claimed 500 points)"
    )
  );
  testHandler(testChatContext, "!unbet", /not betting anymore/);
}

// test multiple people
setBalanceNoReserved(userData, "test", 100);
setBalanceNoReserved(userData, "test1", 100);
setBalanceNoReserved(userData, "test2", 100);

const test1ChatContext = { username: "test1", "user-id": "test1", mod: false };
const test2ChatContext = { username: "test2", "user-id": "test2", mod: false };

testHandler(test1ChatContext, "!bet 50 odd", /test1 placed a bet of 50 on odd/);
testHandler(
  test2ChatContext,
  "!bet 50 even",
  /test2 placed a bet of 50 on even/
);
testHandler(
  testChatContext,
  "!roulette",
  new RegExp(
    "Ball landed on: (\\d*[13579], " +
      "test1 won 50 points with a chance of \\d+% and now has 150 points, " +
      "test2 lost 50 points with a chance of \\d+% and now has 50 points)|" +
      "((\\d+0|\\d*[2468]), " +
      "test1 lost 50 points with a chance of \\d+% and now has 50 points, " +
      "test2 won 50 points with a chance of \\d+% and now has 150 points)|" +
      "(0, " +
      "test1 lost 50 points with a chance of \\d+% and now has 50 points, " +
      "test2 lost 50 points with a chance of \\d+% and now has 50 points)"
  )
);

// test leaderboard
setBalanceNoReserved(userData, "test", 100);
setBalanceNoReserved(userData, "test1", 200);
setBalanceNoReserved(userData, "test2", 300);
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
