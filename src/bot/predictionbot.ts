export { PredictCommand, PredictionBot };

import * as rouletteModule from "../util/roulette";
import {
  BotHandler,
  HandlerContext,
  MappedSchemaFromGet,
  ConfigName,
  Configurable,
  noDefaultValue,
} from "../util/interfaces";
import { BotBase, baseBotConfig } from "./botbase";
import Fraction from "fraction.js";

interface PredictCommand {
  predictNumber: number;
  amount: number;
}

function predictionBotConfig() {
  return baseBotConfig({
    n: noDefaultValue(Number),
  });
}

@ConfigName("PredictionBot", predictionBotConfig)
class PredictionBot extends BotBase implements Configurable {
  readonly handlers: { [key: string]: BotHandler } = {
    predict: {
      action: this.predictHandler.bind(this),
      description: "Predict an outcome, replacing any previous predictions",
      format: "<amount of points> <outcome number>",
    },
    unpredict: {
      action: this.unpredictHandler.bind(this),
      description: "Remove all your predictions",
      format: "",
    },
    openPrediction: {
      action: this.openPredictionHandler.bind(this),
      description: "Open a prediction (mod-only)",
      format: "",
    },
    statusPrediction: {
      action: this.predictStatusHandler.bind(this),
      description: "View the status of the current prediction",
      format: "",
    },
    closePrediction: {
      action: this.closePredictionHandler.bind(this),
      description: "Close the current prediction (mod-only)",
      format: "",
    },
    refundPrediction: {
      action: this.refundHandler.bind(this),
      description: "Refund the current prediction (mod-only)",
      format: "",
    },
    outcomePrediction: {
      action: this.outcomeHandler.bind(this),
      description: "Select a prediction outcome (mod-only)",
      format: "<outcome number>",
    },
  };
  readonly n_places: number;
  readonly all_places: number[];
  readonly prediction: rouletteModule.Prediction;
  predictionOpen = false;

  constructor(config: MappedSchemaFromGet<typeof predictionBotConfig>) {
    super(config);
    this.n_places = config.n.valueOf();
    this.all_places = rouletteModule.RouletteBase.getAllNumbers(this.n_places);
    this.prediction = new rouletteModule.Prediction(this.n_places);
  }

  static parsePredictCommand(
    tokens: string[],
    all_places: number[]
  ): PredictCommand | string {
    if (tokens.length < 3) {
      return "too few arguments";
    }
    if (tokens.length > 3) {
      return "too many arguments";
    }

    let amount = parseInt(tokens[1]);
    if (isNaN(amount) && tokens[1] !== "all") {
      return "amount must be a number or 'all'";
    }

    const parsed = BotBase.parseSpaceRange(tokens[2], all_places);
    if (typeof parsed === "string") {
      return parsed;
    }
    if (parsed.length !== 1) {
      return "can only predict a single outcome";
    }
    return { predictNumber: parsed[0], amount };
  }

  predictHandler(context: HandlerContext, args: string[]): string | undefined {
    const userId = context["user-id"];
    if (!this.predictionOpen) {
      return `Predictions are closed, ${this.addressUser(context)}!`;
    }
    const predictCommand = PredictionBot.parsePredictCommand(
      args,
      this.all_places
    );
    if (typeof predictCommand === "string") {
      return `Parse error: ${predictCommand}, try %{format}, ${this.addressUser(
        context
      )}!`;
    }
    const amount = this.bet(
      context,
      this.prediction,
      userId,
      predictCommand.amount,
      [predictCommand.predictNumber]
    );
    if (typeof amount === "string") {
      return amount;
    }
    console.log(
      `* predict: ${userId}, ${context.username}, ${predictCommand.amount}, ${predictCommand.predictNumber}`
    );
    return `${this.addressUser(context)} predicted ${
      predictCommand.predictNumber
    } with ${amount} points!`;
  }

  unpredictHandler(
    context: HandlerContext,
    args: string[]
  ): string | undefined {
    if (!this.predictionOpen) {
      return `Predictions are closed, ${this.addressUser(context)}!`;
    }
    const userId = context["user-id"];
    this.unbet(context, this.prediction, userId);
    console.log(`* unpredict: ${userId}, ${context.username}`);
    return `${this.addressUser(context)} is not predicting anymore!`;
  }

  predictStatusHandler(
    context: HandlerContext,
    args: string[]
  ): string | undefined {
    const chances = this.prediction.allNumberChances();
    let msg = "Prediction status: ";
    let isFirst = true;
    for (const i of this.prediction.allNumbers) {
      if (chances[i] > 0) {
        if (isFirst) {
          isFirst = false;
        } else {
          msg += ", ";
        }
        msg += `outcome ${i}: ${Math.round(chances[i] * 100)}% of votes (${
          Math.round(100 * (1 / chances[i] - 1)) / 100
        }x coef)`;
      }
    }
    if (isFirst) {
      return "Nothing is predicted yet!";
    }
    return msg;
  }

  refundHandler(context: HandlerContext, args: string[]): string | undefined {
    if (!context.mod) {
      return `Peasant ${this.addressUser(
        context
      )}, you can't refund a prediction!`;
    }
    this.predictionOpen = false;
    this.unbetAll(context, this.prediction);
    console.log(`* refund`);
    return `An honorable mod has refunded the prediction!`;
  }

  openPredictionHandler(
    context: HandlerContext,
    args: string[]
  ): string | undefined {
    if (!context.mod) {
      return `Peasant ${this.addressUser(
        context
      )}, you can't open predictions!`;
    }
    this.predictionOpen = true;
    console.log(`* open`);
    return `An honorable mod has opened a prediction!`;
  }

  closePredictionHandler(
    context: HandlerContext,
    args: string[]
  ): string | undefined {
    if (!context.mod) {
      return `Peasant ${this.addressUser(
        context
      )}, you can't close predictions!`;
    }
    this.predictionOpen = false;
    console.log(`* close`);
    return `An honorable mod has closed the prediction!`;
  }

  outcomeHandler(context: HandlerContext, args: string[]): string | undefined {
    if (!context.mod) {
      return `Peasant ${this.addressUser(
        context
      )}, you can't select a prediction outcome!`;
    }

    let msg = "";

    if (this.predictionOpen) {
      msg += "Closing the prediction. ";
      this.predictionOpen = false;
    }

    if (args.length < 2) {
      return (msg += `Dear mod ${this.addressUser(
        context
      )}, too few arguments`);
    }
    const number = BotBase.parseSpaceRange(args[1], this.all_places);
    if (typeof number === "string") {
      return (msg += `Dear mod ${this.addressUser(
        context
      )}, I couldn't parse the outcome: ${number}!`);
    }
    if (number.length !== 1) {
      return (msg += `Dear mod ${this.addressUser(
        context
      )}, I can only handle a single outcome`);
    }

    this.prediction.winningNumber = number[0];
    msg += `Prediction resulted in outcome '${number}'`;
    const callback = this.createWinningsCallback(
      context,
      (
        userId: string,
        didWin: boolean,
        delta: number,
        chance: number,
        balance: number
      ) => {
        const username = this.addressUser(context, userId);
        if (didWin) {
          return `${username} won ${delta} points (coef ${
            Math.round(100 * (1 / chance - 1)) / 100
          }x) and now has ${balance} points`;
        } else {
          return `${username} lost ${-delta} points (coef ${
            Math.round(100 * (1 / chance - 1)) / 100
          }x) and now has ${balance} points`;
        }
      }
    );
    this.prediction.computeWinnings(
      (
        playerId: string,
        didWin: boolean,
        chance: number,
        amount: number,
        payout: Fraction
      ) => {
        console.log(
          `* outcome: ${playerId}, ${this.getUsername(
            context,
            playerId
          )}, ${payout}`
        );
        msg += ", " + callback(playerId, didWin, chance, amount, payout);
      }
    );
    return msg;
  }
}
