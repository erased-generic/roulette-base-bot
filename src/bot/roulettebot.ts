export { BetCommand, RouletteBot };

import * as rouletteModule from "../util/roulette";
import { UserData } from "../util/userdata";
import { Bot, BotHandler, ChatContext } from "../util/interfaces";
import { BotBase, BotBaseContext, PerUserData } from "./botbase";

interface BetCommand {
  betNumbers: number[];
  betName: string;
  amount: number;
}

enum PredefinedBets {
  Red = "red",
  Black = "black",
  Green = "green",
  Column1 = "column1",
  Column2 = "column2",
  Column3 = "column3",
  Dozen1 = "dozen1",
  Dozen2 = "dozen2",
  Dozen3 = "dozen3",
  Odd = "odd",
  Even = "even",
  "1to18" = "1to18",
  "19to36" = "19to36",
  All = "all",
  All0 = "all0",
}

class RouletteBot extends BotBase implements Bot {
  readonly handlers: { [key: string]: BotHandler } = {
    bet: {
      action: this.betHandler.bind(this),
      description:
        "Place a bet, replacing any previous bets. For a full list of predefined bet names, type !bets",
      format: "<amount of points> <bet name|(outcome number...)>",
    },
    bets: {
      action: this.betsHandler.bind(this),
      description: "View all possible predefined bets",
      format: "",
    },
    unbet: {
      action: this.unbetHandler.bind(this),
      description: "Remove all your bets",
      format: "",
    },
    roulette: {
      action: this.rouletteHandler.bind(this),
      description: "Start the roulette game",
      format: "",
    },
  };
  static readonly N_PLACES = 37;
  static readonly ALL_PLACES = rouletteModule.RouletteBase.getAllNumbers(
    RouletteBot.N_PLACES
  );

  readonly roulette = new rouletteModule.Roulette(RouletteBot.N_PLACES);

  constructor(botContext: BotBaseContext) {
    super(botContext);
  }

  onHandlerCalled(context: ChatContext, args: string[]): void {}

  static parseBetCommand(tokens: string[]): BetCommand | string {
    let betNumbers: number[] = [],
      amount: number;

    if (tokens.length < 3) {
      return "too few arguments";
    }

    {
      const parsed = RouletteBot.parseAmount(tokens[1]);
      if (typeof parsed === "string") {
        return parsed;
      }
      amount = parsed;
    }

    const parseSpaceRanges = (start: number): number[] | string => {
      const res: number[] = [];
      for (let i = 0; i < tokens.length - start; i++) {
        const values = BotBase.parseSpaceRange(
          tokens[start + i],
          RouletteBot.ALL_PLACES
        );
        if (typeof values === "string") {
          return values;
        }
        res.push(...values);
      }
      return res;
    };

    let betName: string;
    const betType = tokens[2].toLowerCase();
    betName = betType;
    const allNumbers = RouletteBot.ALL_PLACES;
    switch (betType) {
      case PredefinedBets.Red:
        betNumbers = [
          1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
        ];
        break;
      case PredefinedBets.Black:
        betNumbers = [
          2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35,
        ];
        break;
      case PredefinedBets.Green:
        betNumbers = [0];
        break;
      case PredefinedBets.Column1:
        betNumbers = allNumbers.filter((x) => x % 3 === 1);
        break;
      case PredefinedBets.Column2:
        betNumbers = allNumbers.filter((x) => x % 3 === 2);
        break;
      case PredefinedBets.Column3:
        betNumbers = allNumbers.filter((x) => x % 3 === 0 && x !== 0);
        break;
      case PredefinedBets.Dozen1:
        betNumbers = allNumbers.filter((x) => x >= 1 && x <= 12);
        break;
      case PredefinedBets.Dozen2:
        betNumbers = allNumbers.filter((x) => x >= 13 && x <= 24);
        break;
      case PredefinedBets.Dozen3:
        betNumbers = allNumbers.filter((x) => x >= 25 && x <= 36);
        break;
      case PredefinedBets.Odd:
        betNumbers = allNumbers.filter((x) => x % 2 === 1);
        break;
      case PredefinedBets.Even:
        betNumbers = allNumbers.filter((x) => x % 2 === 0 && x !== 0);
        break;
      case PredefinedBets["1to18"]:
        betNumbers = allNumbers.filter((x) => x >= 1 && x <= 18);
        break;
      case PredefinedBets["19to36"]:
        betNumbers = allNumbers.filter((x) => x >= 19 && x <= 36);
        break;
      case PredefinedBets.All:
        betNumbers = allNumbers.filter((x) => x > 0);
        break;
      case PredefinedBets.All0:
        betNumbers = allNumbers;
        break;
      default: {
        let parsed = parseSpaceRanges(2);
        if (typeof parsed === "string") {
          return parsed;
        }
        parsed = Array.from(new Set(parsed)).sort((a, b) => a - b);
        betNumbers = parsed;
        betName = parsed.length === 1 ? parsed[0].toString() : "custom bet";
      }
    }

    return { betNumbers, betName, amount };
  }

  betHandler(context: ChatContext, args: string[]): string | undefined {
    // Place a bet
    const userId = context["user-id"];
    const betCommand = RouletteBot.parseBetCommand(args);
    if (typeof betCommand === "string") {
      return `Parse error: ${betCommand}, try %{format}, ${context["username"]}!`;
    }
    const amount = this.bet(
      this.roulette,
      userId,
      betCommand.amount,
      betCommand.betNumbers
    );
    if (typeof amount === "string") {
      return amount;
    }
    console.log(
      `* bet: ${userId}, ${context.username}, ${betCommand.amount}, ${betCommand.betNumbers}`
    );
    return `${context.username} placed a bet of ${amount} on ${betCommand.betName}!`;
  }

  betsHandler(context: ChatContext, args: string[]): string | undefined {
    // List all bets
    return `List of predefined bets: ${Object.values(PredefinedBets).join(
      ", "
    )}`;
  }

  unbetHandler(context: ChatContext, args: string[]): string | undefined {
    // Remove a bet
    const userId = context["user-id"];
    this.unbet(this.roulette, userId);
    console.log(`* unbet: ${userId}, ${context.username}`);
    return `${context.username} is not betting anymore!`;
  }

  rouletteHandler(context: ChatContext, args: string[]): string | undefined {
    let msg = "";
    this.roulette.runRoulette();
    // Run the roulette
    msg += `Ball landed on: ${this.roulette.lastNumber}`;
    const callback = this.createWinningsCallback(
      (
        username: string | undefined,
        didWin: boolean,
        delta: number,
        chance: number,
        balance: number
      ) => {
        const percent = Math.round(chance * 100);
        if (didWin) {
          return `${username} won ${delta} points with a chance of ${percent}% and now has ${balance} points`;
        } else {
          return `${username} lost ${-delta} points with a chance of ${
            100 - percent
          }% and now has ${balance} points`;
        }
      }
    );
    this.roulette.computeWinnings(
      (
        playerId: string,
        didWin: boolean,
        chance: number,
        amount: number,
        payout: number
      ) => {
        console.log(
          `* roulette: ${playerId}, ${this.getUsername(playerId)}, ${payout}`
        );
        msg += ", " + callback(playerId, didWin, chance, amount, payout);
      }
    );
    return msg;
  }
}
