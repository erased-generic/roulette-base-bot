export { MiscBot };

import {
  BotHandler,
  HandlerContext,
  ConfigName,
  Configurable,
} from "../util/interfaces";
import { baseBotConfig, BotBase } from "./botbase";

interface MiscAction {
  price: number;
  description: string;
  format: string;
  action: (
    bot: MiscBot,
    context: HandlerContext,
    args: string[]
  ) => string | undefined;
}

class PrintTextAction implements MiscAction {
  price: number;
  description: string;
  format: string = "";
  action: (
    bot: MiscBot,
    context: HandlerContext,
    args: string[]
  ) => string | undefined;

  constructor(price: number, description: string, text: string) {
    this.price = price;
    this.description = description;
    this.action = (bot, context, args) => {
      return text;
    };
  }
}

function miscBotConfig() {
  return baseBotConfig({});
}

@ConfigName("MiscBot", miscBotConfig)
class MiscBot extends BotBase implements Configurable {
  static readonly actions: { [key: string]: MiscAction } = {
    hydrate: new PrintTextAction(
      10,
      "Hydrate",
      "A friendly reminder to hydrate!"
    ),
    stretch: new PrintTextAction(
      10,
      "Stretch",
      "A friendly reminder to stretch!"
    ),
    eyebreak: new PrintTextAction(
      10,
      "A break for your eyes",
      "A friendly reminder to take a break and look at something 20 feet away (or 6 meters) for 20 seconds!"
    ),
    save: new PrintTextAction(
      10,
      "Save your work",
      "A friendly reminder to save your work!"
    ),
    ping: {
      price: 1,
      description: "Pong",
      format: "",
      action: (bot, context, args) => {
        if (context["sent-at"] !== undefined && !isNaN(context["sent-at"])) {
          return `pong (${Date.now() - context["sent-at"]}ms)`;
        }
        return "pong";
      },
    },
    ctx: {
      price: 1,
      description: "Print context",
      format: "",
      action: (bot, context, args) => {
        return `context: ${JSON.stringify(context)}, args: ${JSON.stringify(
          args
        )}`;
      },
    },
  };

  readonly handlers: { [key: string]: BotHandler } = {
    ...Object.entries(MiscBot.actions).reduce(
      (acc, action) => ({
        ...acc,
        [action[0]]: {
          action: (context, args) =>
            this.actionHandler(context, action[0], args),
          description: `${action[1].description} for ${action[1].price} points`,
          format: action[1].format,
        },
      }),
      {}
    ),
  };

  actionHandler(
    context: HandlerContext,
    action: string,
    args: string[]
  ): string | undefined {
    if (!(action in MiscBot.actions)) {
      return undefined;
    }

    // Buy an action
    const actionPayload = MiscBot.actions[action];
    const userId = context["user-id"];
    const ensured = this.ensureBalance(context, userId, actionPayload.price);
    if (typeof ensured === "string") {
      return ensured;
    }
    this.commitBalance(
      context,
      userId,
      actionPayload.price,
      -actionPayload.price
    );
    console.log(`* action: ${action}, ${userId}, ${context.username}`);
    return actionPayload.action(this, context, args);
  }
}
