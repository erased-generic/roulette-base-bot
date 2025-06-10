export {
  PerUserData,
  onReadUserData,
  BotBase,
  BotBaseContext,
  UsernameUpdaterBot,
  composeBotsWithUsernameUpdater,
  BotManager,
  createMemoryUserData,
  createFileUserData,
};

import { FileUserData, MemoryUserData, UserData, UserDatum } from "../util/userdata";
import { Bot, BotContext, BotHandler, ChatContext, composeBots } from "../util/interfaces";
import { RouletteBase } from "../util/roulette";
import Fraction from "fraction.js";
import { Trie } from "../util/trie";

interface PerUserData extends UserDatum {
  balance: number;
  reservedBalance: number;
  lastClaim?: number;
}

function onReadUserData(userId: string, read: any): PerUserData {
  let defaultPerUserData: PerUserData = {
    username: undefined,
    balance: 100,
    reservedBalance: 0,
    lastClaim: undefined,
  };

  const result = { ...defaultPerUserData, ...read };
  result.reservedBalance = 0;
  return result;
}

class BotBaseContext implements BotContext {
  cmdMarker: string;
  botUsername: string;
  userData: UserData<PerUserData>;

  constructor(
    cmdMarker: string,
    botUsername: string,
    userData: UserData<PerUserData>
  ) {
    this.cmdMarker = cmdMarker;
    this.botUsername = botUsername;
    this.userData = userData;
  }
}

abstract class BotBase implements Bot {
  readonly botContext: BotBaseContext;
  abstract handlers: { [key: string]: BotHandler; };
  private _handlersTrie?: Trie<string, BotHandler>;
  public get handlersTrie(): Trie<string, BotHandler> {
    if (!this._handlersTrie) {
      this._handlersTrie = new Trie<string, BotHandler>(
        Object.entries(this.handlers)
      );
    }
    return this._handlersTrie;
  }

  constructor(botContext: BotBaseContext) {
    this.botContext = botContext;
    botContext.userData.update(
      botContext.botUsername,
      (inPlaceValue: PerUserData) => {
        inPlaceValue.username = botContext.botUsername;
      }
    );
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
    this.botContext.userData.get(context["user-id"]).username =
      context.username;
  }

  getUsername(userId: string) {
    return this.botContext.userData.get(userId).username;
  }

  protected getBalanceInfo(info: PerUserData): number {
    return info.balance - info.reservedBalance;
  }

  protected getBalance(userId: string): number {
    const info = this.botContext.userData.get(userId);
    return this.getBalanceInfo(info);
  }

  protected reserveBalance(userId: string, amount: number) {
    this.botContext.userData.update(userId, (inPlaceValue, hadKey) => {
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
    const info = this.botContext.userData.get(userId);
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
    const botData = this.botContext.userData.get(this.botContext.botUsername);
    return this.botContext.userData.update(userId, (inPlaceValue, hadKey) => {
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

class UsernameUpdaterBot extends BotBase {
  handlers: {};

  constructor(botContext: BotBaseContext) {
    super(botContext);
  }

  onHandlerCalled(context: ChatContext, args: string[]): void {
    this.updateUsername(context);
  }
}

function composeBotsWithUsernameUpdater(
  botConstructors: ((botContext: BotBaseContext) => Bot)[],
  botContext: BotBaseContext
): Bot {
  const bots = [
    new UsernameUpdaterBot(botContext),
    ...botConstructors.map((constructor) => constructor(botContext)),
  ];
  return composeBots(bots);
}

function createFileUserData(channel: string): UserData<PerUserData> {
  const data = new FileUserData<PerUserData>(
    onReadUserData,
    `data/private/${channel}/table.json`
  );
  return data;
}

function createMemoryUserData(channel: string): UserData<PerUserData> {
  const data = new MemoryUserData<PerUserData>(onReadUserData, {});
  return data;
}

class BotManager {
  botFactory: (channel: string, userData: UserData<PerUserData>) => Bot;
  userDataFactory: (channel: string) => UserData<PerUserData>;
  theBots: { [channel: string]: Bot } = {};

  constructor(
    botFactory: (channel: string, userData: UserData<PerUserData>) => Bot,
    userDataFactory: (channel: string) => UserData<PerUserData>
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
