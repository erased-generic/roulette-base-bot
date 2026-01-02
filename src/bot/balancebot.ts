export {
  balanceBotConfig,
  BalanceBot,
  BalanceUserDataSchema,
  balanceBotUserData,
};

import {
  BotHandler,
  HandlerContext,
  MappedSchemaFromGet,
  ConfigName,
  Configurable,
  formatTime,
  combineSchemas,
  optionalValue,
} from "../util/interfaces";
import {
  baseBotConfig,
  baseBotConfigU,
  baseUserData,
  BotBase,
  PredefinedHandler,
} from "./botbase";

function balanceBotUserData() {
  return combineSchemas(baseUserData(), {
    balance: 100,
    reservedBalance: 0,
    lastClaim: optionalValue(Number),
  });
}

type BalanceUserDataSchema = ReturnType<typeof balanceBotUserData>;

function balanceBotConfig() {
  return baseBotConfigU(baseBotConfig({}), balanceBotUserData());
}

@ConfigName("BalanceBot", balanceBotConfig)
class BalanceBot
  extends BotBase<BalanceUserDataSchema>
  implements Configurable
{
  static readonly CLAIM_SIZE = 100;
  static readonly CLAIM_COOLDOWN_MINUTES = 30;
  static readonly CLAIM_TRICKERY_CHANCE_PERCENT = 1;
  static readonly CLAIME_TRICKERY_CHANCE_PERCENT = 0;
  static readonly DEFAULT_BOARD_SIZE = 3;

  readonly handlers: { [key: string]: BotHandler } = {
    claim: {
      action: this.claimHandler.bind(this),
      description:
        `Claim ${BalanceBot.CLAIM_SIZE} points with a ${BalanceBot.CLAIM_COOLDOWN_MINUTES}-minute cooldown. ` +
        `Has a ${BalanceBot.CLAIM_TRICKERY_CHANCE_PERCENT}% chance of doubling or halving your balance`,
      format: "",
    },
    claime: {
      action: this.claimeHandler.bind(this),
      description:
        `Claim ${BalanceBot.CLAIM_SIZE} points with a ${BalanceBot.CLAIM_COOLDOWN_MINUTES}-minute cooldown. ` +
        `If you're (un)lucky, doubles or halves your balance`,
      format: `[<chance of trickery in %>]=${BalanceBot.CLAIME_TRICKERY_CHANCE_PERCENT}`,
    },
    balance: {
      action: this.pointsHandler.bind(this),
      description: "View your balance",
      format: "",
    },
    budget: {
      action: this.budgetHandler.bind(this),
      description: "View the bot's balance",
      format: "",
    },
    leaderboard: {
      action: this.leaderboardHandler.bind(this),
      description: "View the leaderboard, sorted by the amount of points",
      format: `[<number of entries to show>]=${BalanceBot.DEFAULT_BOARD_SIZE}`,
    },
    ...Object.fromEntries([
      BotBase.toHandler(
        PredefinedHandler.ReserveBalance,
        this.reserveBalanceImpl.bind(this)
      ),
      BotBase.toHandler(
        PredefinedHandler.UpdateBalance,
        this.updateBalanceImpl.bind(this)
      ),
      BotBase.toHandler(
        PredefinedHandler.GetBalance,
        this.getBalanceImpl.bind(this)
      ),
    ]),
  };

  constructor(config: MappedSchemaFromGet<typeof balanceBotConfig>) {
    super(config);
  }

  pointsHandler(context: HandlerContext, args: string[]): string | undefined {
    // Print the user's points
    const userId = context["user-id"];
    const info = this.userData.get(userId);

    let msg = `You have ${info.balance} points`;
    if (info.reservedBalance > 0) {
      msg += ` (currently betted ${info.reservedBalance} of those)`;
    }
    return msg + `, ${context["username"]}!`;
  }

  budgetHandler(context: HandlerContext, args: string[]): string | undefined {
    // Print the bot's points
    const info = this.userData.get(this.botContext.botUsername);

    let msg = `The casino has ${info.balance} points`;
    if (info.reservedBalance > 0) {
      msg += ` (currently betted ${info.reservedBalance} of those)`;
    }
    return msg;
  }

  doClaim(context: HandlerContext, chance: number): string | undefined {
    // Claim 100 points per 30 minutes
    // If `Math.rand() < chance`, double or half your balance
    const claimSize = BalanceBot.CLAIM_SIZE;
    const claimCooldown = BalanceBot.CLAIM_COOLDOWN_MINUTES * 60 * 1000;

    const userId = context["user-id"];

    const lastClaim = this.userData.get(userId).lastClaim;
    const now = Date.now();
    if (lastClaim !== undefined) {
      const elapsed = now - lastClaim.valueOf();
      if (elapsed < claimCooldown) {
        return `You are on cooldown, ${
          context["username"]
        }! Please wait for ${formatTime(claimCooldown - elapsed)}`;
      }
    }
    let msg = ``;
    let balance = this.getBalance(context, userId);
    let delta = claimSize;
    const trickery = Math.random();
    const trickery2 = Math.random();
    if (trickery < chance) {
      if (trickery2 < 0.5) {
        delta = Math.floor(balance / 2) - balance;
        msg += `You halved your balance!`;
      } else {
        delta = balance;
        msg += `You doubled your balance!`;
      }
    }
    this.userData.update(userId, (inPlaceValue, hadKey) => {
      inPlaceValue.lastClaim = now;
      balance = inPlaceValue.balance += delta;
    });
    if (delta < claimSize) {
      msg = "Unlucky! " + msg;
    } else if (delta > claimSize) {
      msg = "Lucky! " + msg;
    }
    console.log(
      `* claim: ${userId}, ${context.username}, ${delta}, ${trickery} <> ${chance}, ${trickery2}`
    );
    return (
      msg +
      ` You claimed ${delta} points and now have ${balance} points, ${context["username"]}!`
    );
  }

  claimHandler(context: HandlerContext, args: string[]): string | undefined {
    return this.doClaim(
      context,
      BalanceBot.CLAIM_TRICKERY_CHANCE_PERCENT / 100
    );
  }

  claimeHandler(context: HandlerContext, args: string[]): string | undefined {
    if (args.length < 2) {
      return this.doClaim(
        context,
        BalanceBot.CLAIME_TRICKERY_CHANCE_PERCENT / 100
      );
    }
    const chance = parseFloat(args[1]);
    if (!isFinite(chance)) {
      return `Parse error: ${args[1]}, try %{format}, ${context["username"]}!`;
    }
    return this.doClaim(context, chance / 100);
  }

  leaderboardHandler(
    context: HandlerContext,
    args: string[]
  ): string | undefined {
    let boardSize = BalanceBot.DEFAULT_BOARD_SIZE;
    if (args.length > 1) {
      boardSize = parseInt(args[1]);
      if (isNaN(boardSize)) {
        return `Parse error: ${args[1]}, try %{format}, ${context["username"]}!`;
      }
    }
    return (
      `Top ${boardSize} richest people in our chat: ` +
      Object.entries(this.userData.getAll())
        .filter(([id, data]) => id !== this.botContext.botUsername)
        .map(([id, data]) => {
          return { username: data.username, balance: data.balance };
        })
        .sort((a, b) => b.balance - a.balance)
        .slice(0, boardSize)
        .map((a) => `${a.username} with ${a.balance} points`)
        .join(";\n") +
      "."
    );
  }

  private reserveBalanceImpl(
    context: HandlerContext,
    args: { userId: String; amount: Number }
  ): void {
    this.userData.update(args.userId.toString(), (inPlaceValue, hadKey) => {
      console.log(
        `* reserveBalance: ${args.userId}, ${
          inPlaceValue.username
        }, ${JSON.stringify(inPlaceValue)}, ${args.amount}`
      );
      inPlaceValue.reservedBalance += args.amount.valueOf();
    });
  }

  private updateBalanceImpl(
    context: HandlerContext,
    args: { userId: String; amount: Number }
  ): number {
    return this.userData.update(
      args.userId.toString(),
      (inPlaceValue, hadKey) => {
        console.log(
          `* updateBalance: ${args.userId}, ${
            inPlaceValue.username
          }, ${JSON.stringify(inPlaceValue)}, ${args.amount}`
        );
        inPlaceValue.balance += args.amount.valueOf();
      }
    ).balance;
  }

  private getBalanceImpl(
    context: HandlerContext,
    args: { userId: String }
  ): number {
    const data = this.userData.get(args.userId.toString());
    console.log(
      `* getBalance: ${args.userId}, ${context.username}, ${JSON.stringify(
        data
      )}`
    );
    return data.balance - data.reservedBalance;
  }
}
