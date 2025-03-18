export { MiscBot };

import { Bot, BotHandler, ChatContext } from "../util/interfaces";
import { BotBase, BotBaseContext, PerUserData } from "./botbase";

interface MiscAction {
  price: number;
  description: string;
  format: string;
  action: (bot: MiscBot, context: ChatContext, args: string[]) => string | undefined;
}

class PrintTextAction implements MiscAction {
  price: number;
  description: string;
  format: string = "";
  action: (bot: MiscBot, context: ChatContext, args: string[]) => string | undefined;

  constructor(price: number, description: string, text: string) {
    this.price = price;
    this.description = description;
    this.action = (bot, context, args) => {
      return text;
    }
  }
}

class MiscBot extends BotBase implements Bot {
  static readonly actions: { [key: string]: MiscAction } = {
    hydrate: new PrintTextAction(10, "Hydrate", "A friendly reminder to hydrate!"),
    stretch: new PrintTextAction(10, "Stretch", "A friendly reminder to stretch!"),
    ping: new PrintTextAction(1, "Ping", "pong"),
  }

  readonly handlers: { [key: string]: BotHandler } = {
    ...Object.entries(MiscBot.actions).reduce(
      (acc, action) => ({
        ...acc,
        [action[0]]: {
          action: (context, args) => this.actionHandler(context, action[0], args),
          description: `${action[1].description} for ${action[1].price} points`,
          format: action[1].format,
        },
      }),
      {}
    )
  };

  onHandlerCalled(context: ChatContext, args: string[]): void {}

  actionHandler(context: ChatContext, action: string, args: string[]): string | undefined {
    if (!(action in MiscBot.actions)) {
      return undefined;
    }

    // Buy an action
    const actionPayload = MiscBot.actions[action];
    const userId = context["user-id"];
    const ensured = this.ensureBalance(userId, actionPayload.price);
    if (typeof ensured === "string") {
      return ensured;
    }
    this.commitBalance(userId, actionPayload.price, -actionPayload.price);
    console.log(`* action: ${action}, ${userId}, ${context.username}`);
    return actionPayload.action(this, context, args);
  }
}
