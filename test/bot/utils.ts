export {
  instanceTestHandler,
  createTestUserData,
  createTestBotContext,
  createTestBotConfig,
  createTestBot,
  splitCommand,
  instanceTestParser,
  setBalanceNoReserved,
  setBalance,
};

import * as assert from "assert";
import {
  Bot,
  ChatContext,
  MappedSchema,
  MappedSchemaFromGet,
  callHandler,
  composeBots,
  selectHandler,
  splitCommand,
} from "../../src/util/interfaces";
import {
  BaseUserDataSchema,
  BotBaseContext,
  UsernameUpdaterBot,
  concreteBaseBotConfig,
} from "../../src/bot/botbase";
import { MemoryUserData, UserData, UserDatum } from "../../src/util/userdata";
import {
  BalanceBot,
  balanceBotConfig,
  balanceBotUserData,
  BalanceUserDataSchema,
} from "../../src/bot/balancebot";

function testUserData() {
  return balanceBotUserData();
}

type TestUserDataSchema = MappedSchemaFromGet<typeof testUserData>;

function createTestUserData() {
  return new MemoryUserData({}).withSchema(testUserData());
}

function createTestBotContext() {
  return new BotBaseContext({
    cmdMarker: "!",
    botUsername: "testbot",
  });
}

function createTestBotConfig() {
  return { botContext: createTestBotContext(), userData: createTestUserData() };
}

function createTestBot(
  bots: Bot[],
  config: MappedSchemaFromGet<typeof balanceBotConfig> &
    MappedSchemaFromGet<typeof concreteBaseBotConfig>
) {
  return composeBots([
    new BalanceBot(config),
    new UsernameUpdaterBot(config),
    ...bots,
  ]);
}

function instanceTestParser<T>(
  parse: (args: string[]) => T | string,
  command: string,
  expected: T | undefined
) {
  if (expected === undefined) {
    assert.strictEqual(typeof parse(splitCommand(command)), "string");
  } else {
    assert.deepStrictEqual(parse(splitCommand(command)), expected);
  }
}

function instanceTestHandler(
  botInstance: Bot,
  chatContext: ChatContext,
  command: string,
  expected: RegExp
): string {
  const selected = selectHandler(botInstance, command);
  assert.ok(selected !== undefined);
  assert.ok(selected.handler !== undefined);
  const result = callHandler(
    botInstance,
    selected.handler,
    chatContext,
    selected.args
  );
  assert.ok(result !== undefined);
  assert.match(result, expected);
  return result;
}

function setBalance(
  userData: UserData<MappedSchema<BaseUserDataSchema>>,
  userId: string,
  balance: number
) {
  userData.get(userId).balance = balance;
}

function setBalanceNoReserved(
  userData: UserData<MappedSchema<BaseUserDataSchema>>,
  userId: string,
  balance: number
) {
  userData.get(userId).balance = balance;
  assert.strictEqual(userData.get(userId).reservedBalance, 0);
}
