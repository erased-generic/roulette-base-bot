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
  PredefinedHandler,
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
  HandlerContext,
  composeBots,
  Schema,
  MappedSchemaFromGet,
  ConfigName,
  Configurable,
  ConfigurableRegistry,
  noDefaultValue,
  isValidBySchema,
  MappedSchema,
  optionalValue,
  callHandler,
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

enum PredefinedHandler {
  GetBalance = "_getBalance",
  ReserveBalance = "_reserveBalance",
  UpdateBalance = "_updateBalance",
  AddressUser = "_addressUser",
}

const PredefinedHandlers = {
  [PredefinedHandler.GetBalance]: { userId: noDefaultValue(String) },
  [PredefinedHandler.ReserveBalance]: {
    userId: noDefaultValue(String),
    amount: noDefaultValue(Number),
  },
  [PredefinedHandler.UpdateBalance]: {
    userId: noDefaultValue(String),
    amount: noDefaultValue(Number),
  },
  [PredefinedHandler.AddressUser]: { userId: noDefaultValue(String) },
};

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

  onHandlerCalled(context: HandlerContext, args: string[]): void {}

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

  protected callHandler<H extends PredefinedHandler>(
    context: HandlerContext,
    handlerName: H,
    args: MappedSchema<(typeof PredefinedHandlers)[H]>
  ): string | undefined {
    const toCall = context.self.handlers[handlerName];
    if (toCall === undefined) {
      console.log(`* no handler for predefined ${handlerName}`);
      return undefined;
    }
    return callHandler(context.self, toCall, context, [
      `${this.botContext.cmdMarker}${handlerName}`,
      JSON.stringify(args),
    ]);
  }

  protected static toHandler<H extends PredefinedHandler>(
    handlerName: H,
    method: (
      ctx: HandlerContext,
      args: MappedSchema<(typeof PredefinedHandlers)[H]>
    ) => unknown
  ): [H, BotHandler] {
    const schema = PredefinedHandlers[handlerName];
    return [
      handlerName,
      {
        action: (context: HandlerContext, args: string[]) => {
          if (args.length < 2) {
            console.log(
              `* invalid args length for predefined ${handlerName}: ${args}`
            );
            return undefined;
          }
          const parsedArgs = JSON.parse(args[1]);
          if (!isValidBySchema(parsedArgs, schema)) {
            console.log(
              `* invalid args for predefined ${handlerName}: ${args}`
            );
            return undefined;
          }
          return method(context, parsedArgs)?.toString();
        },
        description: "",
        format: "",
      },
    ];
  }

  addressUser(context: HandlerContext, userId?: string): string {
    const user = userId ?? context["user-id"];
    return (
      this.callHandler(context, PredefinedHandler.AddressUser, {
        userId: user,
      }) ??
      this.getUsername(context, user) ??
      user
    );
    // TODO: replace all addressing to users with this method
    // TODO: think about moving balance handling to a separate bot as well
  }

  updateUsername(context: HandlerContext) {
    this.getUserData().update(context["user-id"], (inPlaceValue) => {
      inPlaceValue.username = context.username;
    });
  }

  public getUsername(context: HandlerContext, userId: string) {
    return this.getUserData().get(userId).username?.toString();
  }

  protected getBalance(context: HandlerContext, userId: string): number {
    return Number(
      this.callHandler(context, PredefinedHandler.GetBalance, { userId })
    );
  }

  protected reserveBalance(
    context: HandlerContext,
    userId: string,
    amount: number
  ) {
    this.callHandler(context, PredefinedHandler.ReserveBalance, {
      userId,
      amount,
    });
  }

  protected ensureBalance(
    context: HandlerContext,
    userId: string,
    amount: number,
    extraReserveLimit?: number
  ): number | string {
    if (amount <= 0) {
      return `You can bet only a positive amount of points, ${this.addressUser(
        context,
        userId
      )}!`;
    }
    const balance = this.getBalance(context, userId) + (extraReserveLimit ?? 0);
    amount = isNaN(amount) ? balance : amount;
    if (!(amount <= balance)) {
      return `You don't have that many points, ${this.addressUser(
        context,
        userId
      )}!`;
    }
    this.reserveBalance(context, userId, amount - (extraReserveLimit ?? 0));
    return amount;
  }

  protected updateBalance(
    context: HandlerContext,
    userId: string,
    amount: number
  ): number {
    return Number(
      this.callHandler(context, PredefinedHandler.UpdateBalance, {
        userId,
        amount,
      })
    );
  }

  protected commitBalance(
    context: HandlerContext,
    userId: string,
    reservedAmount: number,
    balanceAmount: number
  ): number {
    this.reserveBalance(context, userId, -reservedAmount);
    this.updateBalance(context, this.botContext.botUsername, -balanceAmount);
    return this.updateBalance(context, userId, balanceAmount);
  }

  protected createWinningsCallback(
    context: HandlerContext,
    message: (
      userId: string,
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
      const balance = this.commitBalance(
        context,
        playerId,
        amount,
        actualPayout
      );
      return message(playerId, didWin, actualPayout, chance, balance);
    };
  }

  protected bet(
    context: HandlerContext,
    rouletteBase: RouletteBase,
    userId: string,
    amount: number,
    numbers: number[]
  ): number | string {
    const ensured = this.ensureBalance(
      context,
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

  protected unbet(
    context: HandlerContext,
    rouletteBase: RouletteBase,
    userId: string
  ) {
    const prevBet = rouletteBase.getBet(userId);
    if (prevBet !== undefined) {
      this.reserveBalance(context, userId, -prevBet);
    }
    rouletteBase.unplaceBet(userId);
  }

  protected unbetAll(context: HandlerContext, rouletteBase: RouletteBase) {
    for (const userId in rouletteBase.bets) {
      this.unbet(context, rouletteBase, userId);
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

@ConfigName("UsernameUpdaterBot", concreteBaseBotConfig)
class UsernameUpdaterBot extends BotBase {
  handlers: {};

  override onHandlerCalled(context: HandlerContext, args: string[]): void {
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
