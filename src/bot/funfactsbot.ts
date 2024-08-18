export { FunFactsBot };

import { UserData } from "../util/userdata";
import { Bot, BotHandler, ChatContext } from "../util/interfaces";
import { BotBase, BotBaseContext, PerUserData } from "./botbase";
import * as fs from "fs";

class FunFactsBot extends BotBase implements Bot {
  static readonly FACT_PRICE = 500;
  facts: string[];

  readonly handlers: { [key: string]: BotHandler } = {
    fact: {
      action: this.factHandler.bind(this),
      description: `Request a fun fact for ${FunFactsBot.FACT_PRICE} points`,
      format: "",
    },
  };

  constructor(botContext: BotBaseContext, filePath: string) {
    super(botContext);
    this.facts = (() => {
      try {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
      } catch (e) {
        if (e.code === "ENOENT") {
          return [];
        }
        throw e;
      }
    })();
  }

  onHandlerCalled(context: ChatContext, args: string[]): void {}

  factHandler(context: ChatContext, args: string[]): string | undefined {
    // Buy a fun fact
    const userId = context["user-id"];
    const ensured = this.ensureBalance(userId, FunFactsBot.FACT_PRICE);
    if (typeof ensured === "string") {
      return `Fun fact: ${ensured}`;
    }
    this.commitBalance(userId, FunFactsBot.FACT_PRICE, -FunFactsBot.FACT_PRICE);
    console.log(`* funfact: ${userId}, ${context.username}`);
    if (this.facts.length > 0) {
      return `Fun fact: ${
        this.facts[Math.floor(Math.random() * this.facts.length)]
      }`;
    }
    return `Fun fact: scammed!`;
  }
}
