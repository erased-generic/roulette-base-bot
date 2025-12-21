export {
  concreteBaseBotConfig,
  BotBase,
  BotBaseContext,
  UsernameUpdaterBot,
  BotManager,
  createMemoryUserData,
  createFileUserData,
  createConfigurableBotFactory,
  baseUserData,
  BaseUserDataSchema,
  baseBotConfigU,
  baseBotConfig,
};

import {
  FileUserData,
  MemoryUserData,
  UserData,
  UserDatum,
} from "../util/userdata";
import {
  Bot,
  BotContext,
  BotHandler,
  ChatContext,
  composeBots,
  Schema,
  MappedSchemaFromGet,
  ConfigName,
  Configurable,
  ConfigurableRegistry,
  noDefaultValue,
  isValidBySchema,
  MappedSchemaElement,
  MappedSchema,
  optionalValue,
  OptionalValue,
  applySchema,
} from "../util/interfaces";
import { RouletteBase } from "../util/roulette";
import Fraction from "fraction.js";
import { Trie } from "../util/trie";
import * as yaml from "yaml";
import * as fs from "fs";

function botBaseContextConfig() {
  return {
    cmdMarker: noDefaultValue(String),
    botUsername: noDefaultValue(String),
  };
}

@ConfigName("BotBaseContext", botBaseContextConfig)
class BotBaseContext implements BotContext, Configurable {
  cmdMarker: string;
  botUsername: string;

  constructor(config: MappedSchemaFromGet<typeof botBaseContextConfig>) {
    this.cmdMarker = config.cmdMarker.valueOf();
    this.botUsername = config.botUsername.valueOf();
  }
}

function baseUserData() {
  return {
    username: optionalValue(String),
    balance: 100,
    reservedBalance: 0,
  };
}

type BaseUserDataSchema = ReturnType<typeof baseUserData>;

function baseBotConfigU<
  T extends Schema,
  U extends BaseUserDataSchema = BaseUserDataSchema
>(configSchema: T, userDataSchema: U) {
  return {
    botContext: noDefaultValue(BotBaseContext),
    userData: noDefaultValue(UserData<MappedSchema<U>>, (u) => {
      return isValidBySchema(
        u.withSchema(userDataSchema).getDefaultData(),
        userDataSchema
      );
    }),
    ...configSchema,
  };
}

function baseBotConfig<T extends Schema>(configSchema: T) {
  return baseBotConfigU(configSchema, baseUserData());
}

function concreteBaseBotConfig() {
  return baseBotConfig({} as Schema);
}

abstract class BotBase<U extends BaseUserDataSchema = BaseUserDataSchema>
  implements Bot, Configurable
{
  readonly botContext: BotBaseContext;
  readonly userData: UserData<MappedSchema<U>>;
  abstract handlers: { [key: string]: BotHandler };
  private _handlersTrie?: Trie<string, BotHandler>;
  public get handlersTrie(): Trie<string, BotHandler> {
    if (!this._handlersTrie) {
      this._handlersTrie = new Trie<string, BotHandler>(
        Object.entries(this.handlers)
      );
    }
    return this._handlersTrie;
  }

  private getUserData(): UserData<MappedSchemaFromGet<typeof baseUserData>> {
    // helper to circumvent TS type checking with MappedSchema<U>
    return this.userData;
  }

  constructor(config: MappedSchemaFromGet<typeof baseBotConfigU<Schema, U>>) {
    this.botContext = config.botContext;
    this.userData = config.userData;
    this.getUserData().update(this.botContext.botUsername, (inPlaceValue) => {
      inPlaceValue.username = this.botContext.botUsername;
    });
  }

  abstract onHandlerCalled(context: ChatContext, args: string[]): void;

  getContext(): BotContext {
    return this.botContext;
  }

  static parseSpaceRange(arg: string, all_places: number[]): number[] | string {
    if (arg.match(/^\d+$/)) {
      const value = parseInt(arg);
      if (isNaN(value) || !all_places.includes(value)) {
        return `invalid space '${arg}'`;
      }
      return [value];
    } else if (arg.match(/^\d+-\d+$/)) {
      const args = arg.split("-");
      const start = parseInt(args[0]);
      const end = parseInt(args[1]);
      if (
        isNaN(start) ||
        isNaN(end) ||
        !all_places.includes(start) ||
        !all_places.includes(end) ||
        start > end
      ) {
        return `invalid space range '${arg}'`;
      }
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
    return `invalid space argument '${arg}'`;
  }

  static parseAmount(arg: string): number | string {
    const amount = parseInt(arg);
    if (isNaN(amount) && arg !== "all") {
      return "amount must be a number or 'all'";
    }
    return amount;
  }

  updateUsername(context: ChatContext) {
    this.getUserData().get(context["user-id"]).username =
      context.username ?? "abc";
  }

  getUsername(userId: string) {
    return this.getUserData().get(userId).username?.toString();
  }

  protected getBalanceInfo(
    info: MappedSchemaFromGet<typeof baseUserData>
  ): number {
    return info.balance - info.reservedBalance;
  }

  protected getBalance(userId: string): number {
    const info = this.getUserData().get(userId);
    return this.getBalanceInfo(info);
  }

  protected reserveBalance(userId: string, amount: number) {
    this.getUserData().update(userId, (inPlaceValue, hadKey) => {
      console.log(
        `* reserveBalance: ${userId}, ${
          inPlaceValue.username
        }, ${JSON.stringify(inPlaceValue)}, ${amount}`
      );
      inPlaceValue.reservedBalance += amount;
    });
  }

  protected ensureBalance(
    userId: string,
    amount: number,
    extraReserveLimit?: number
  ): number | string {
    const info = this.getUserData().get(userId);
    if (amount <= 0) {
      return `You can bet only a positive amount of points, ${info.username}!`;
    }
    const balance = this.getBalance(userId) + (extraReserveLimit ?? 0);
    amount = isNaN(amount) ? balance : amount;
    if (amount > balance) {
      return `You don't have that many points, ${info.username}!`;
    }
    this.reserveBalance(userId, amount - (extraReserveLimit ?? 0));
    return amount;
  }

  protected commitBalance(
    userId: string,
    reservedAmount: number,
    balanceAmount: number
  ): number {
    const botData = this.getUserData().get(this.botContext.botUsername);
    return this.getUserData().update(userId, (inPlaceValue, hadKey) => {
      console.log(
        `* balance: ${userId}, ${this.getUsername(userId)}, ${JSON.stringify(
          inPlaceValue
        )}, ${reservedAmount}, ${balanceAmount}`
      );
      inPlaceValue.reservedBalance -= reservedAmount;
      inPlaceValue.balance += balanceAmount;
      // NOTE: direct update of UserData here
      botData.balance -= balanceAmount;
    }).balance;
  }

  protected createWinningsCallback(
    message: (
      username: string | undefined,
      didWin: boolean,
      payout: number,
      percent: number,
      balance: number
    ) => string
  ) {
    return (
      playerId: string,
      didWin: boolean,
      chance: number,
      amount: number,
      payout: Fraction
    ) => {
      let actualPayout = payout.floor().valueOf();
      const balance = this.commitBalance(playerId, amount, actualPayout);
      return message(
        this.getUsername(playerId),
        didWin,
        actualPayout,
        chance,
        balance
      );
    };
  }

  protected bet(
    rouletteBase: RouletteBase,
    userId: string,
    amount: number,
    numbers: number[]
  ): number | string {
    const ensured = this.ensureBalance(
      userId,
      amount,
      rouletteBase.getBet(userId)
    );
    if (typeof ensured === "string") {
      return ensured;
    }
    rouletteBase.placeBet(userId, ensured, numbers);
    return ensured;
  }

  protected unbet(rouletteBase: RouletteBase, userId: string) {
    const prevBet = rouletteBase.getBet(userId);
    if (prevBet !== undefined) {
      this.reserveBalance(userId, -prevBet);
    }
    rouletteBase.unplaceBet(userId);
  }

  protected unbetAll(rouletteBase: RouletteBase) {
    for (const userId in rouletteBase.bets) {
      this.unbet(rouletteBase, userId);
    }
    rouletteBase.reset();
  }

  static appendMsg(msg1: string, msg2: string, sep: string = " ") {
    if (msg1.length > 0 && !msg1.endsWith(sep) && msg2.length > 0) {
      return msg1 + sep + msg2;
    }
    return msg1 + msg2;
  }
}

@ConfigName("UsernameUpdaterBot", () => concreteBaseBotConfig)
class UsernameUpdaterBot extends BotBase {
  handlers: {};

  onHandlerCalled(context: ChatContext, args: string[]): void {
    this.updateUsername(context);
  }
}

function createFileUserData(channel: string): UserData<UserDatum> {
  const data = new FileUserData(`data/private/${channel}/table.json`);
  return data;
}

function createMemoryUserData(channel: string): UserData<UserDatum> {
  const data = new MemoryUserData({});
  return data;
}

class BotManager<U extends UserDatum> {
  botFactory: (channel: string, userData: UserData<U>) => Bot;
  userDataFactory: (channel: string) => UserData<U>;
  theBots: { [channel: string]: Bot } = {};

  constructor(
    botFactory: (channel: string, userData: UserData<U>) => Bot,
    userDataFactory: (channel: string) => UserData<U>
  ) {
    this.botFactory = botFactory;
    this.userDataFactory = userDataFactory;
  }

  getOrCreateBot(channel: string): Bot {
    if (!this.theBots[channel]) {
      this.theBots[channel] = this.botFactory(
        channel,
        this.userDataFactory(channel)
      );
    }
    return this.theBots[channel];
  }
}

function isPrimitive(value: any): boolean {
  return typeof value !== "object" || value === null;
}

function isRaw(value: any): boolean {
  return (
    value instanceof Map || value instanceof Set || value.constructor === Object
  );
}

function createConfigurableBotFactory(
  botUsername: string,
  configPath: string
): (channel: string, userData: UserData<UserDatum>) => Bot {
  return (channel: string, userData: UserData<UserDatum>) => {
    ConfigurableRegistry.register("BotUsername", () => botUsername);
    ConfigurableRegistry.register("UserData", () => userData);
    const config = yaml.parse(
      fs.readFileSync(configPath, "utf8"),
      (key, value) => {
        if (isPrimitive(value)) {
          // primitive value parsed
          return value;
        }

        // non-primitive
        const obj = value as Object;
        if (!isRaw(obj)) {
          // already revived
          return obj;
        }

        // apply inheritance
        let newObj = { ...obj };
        while ("<<" in newObj) {
          const parent = obj["<<"] as Object;
          delete newObj["<<"];
          newObj = { ...newObj, ...parent };
        }

        // apply configuration
        if ("name" in newObj) {
          const name = newObj["name"];
          if (typeof name !== "string") {
            throw new Error(
              `Invalid config for ${name} - name must be a string`
            );
          }
          const ctor = ConfigurableRegistry.get(name);
          if (ctor === undefined) {
            throw new Error(`Unknown config for ${name} - unknown config name`);
          }
          delete newObj["name"];
          const configured = ctor(newObj);
          if (configured === undefined) {
            throw new Error("Invalid config for " + name);
          }
          return configured;
        }
        return newObj;
      }
    );
    const bots = config["bots"];
    if (bots === undefined) {
      throw new Error("No bots defined in config");
    }
    return composeBots(bots as Bot[]);
  };
}
