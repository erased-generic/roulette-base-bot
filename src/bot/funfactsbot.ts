export { FunFactsBot };

import {
  BotHandler,
  HandlerContext,
  MappedSchemaFromGet,
  ConfigName,
  Configurable,
  noDefaultValue,
} from "../util/interfaces";
import { baseBotConfig, BotBase, BotBaseContext } from "./botbase";
import * as fs from "fs";

function funFactsBotConfig() {
  return baseBotConfig({
    filePath: noDefaultValue(String),
  });
}

@ConfigName("FunFactsBot", funFactsBotConfig)
class FunFactsBot extends BotBase implements Configurable {
  static readonly FACT_PRICE = 333;
  facts: string[];
  weightSums: number[];

  readonly handlers: { [key: string]: BotHandler } = {
    fact: {
      action: this.factHandler.bind(this),
      description: `Request a fun fact for ${FunFactsBot.FACT_PRICE} points`,
      format: "",
    },
  };

  constructor(config: MappedSchemaFromGet<typeof funFactsBotConfig>) {
    super(config);
    this.facts = (() => {
      try {
        return JSON.parse(fs.readFileSync(config.filePath.valueOf(), "utf-8"));
      } catch (e) {
        if (e.code === "ENOENT") {
          return [];
        }
        throw e;
      }
    })();
    let sum = 0;
    this.weightSums = this.facts
      .map((v: string, i: number) => 1 << i)
      .map((v: number) => (sum += v))
      .map((v: number) => v / sum);
  }

  factHandler(context: HandlerContext, args: string[]): string | undefined {
    // Buy a fun fact
    const userId = context["user-id"];
    const ensured = this.ensureBalance(context, userId, FunFactsBot.FACT_PRICE);
    if (typeof ensured === "string") {
      return `Fun fact: ${this.ensureBalanceErrorToString(
        context,
        userId,
        ensured
      )}`;
    }
    this.commitBalance(
      context,
      userId,
      FunFactsBot.FACT_PRICE,
      -FunFactsBot.FACT_PRICE
    );
    const roll = Math.random();
    let index = this.weightSums.findIndex((v: number, i: number) => roll <= v);
    console.log(`* funfact: ${userId}, ${context.username}`);
    if (this.facts.length > 0) {
      return `Fun fact: ${
        this.facts[index === -1 ? this.facts.length - 1 : index]
      }`;
    }
    return `Fun fact: scammed!`;
  }
}
