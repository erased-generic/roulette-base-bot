export { blackJackDuelImplConfig, BlackJackDuelImpl };

import * as blackjackModule from "../util/blackjack";
import {
  MappedSchemaFromGet,
  ConfigName,
  Configurable,
  GameBrain,
  GameResult,
  HandlerContext,
} from "../util/interfaces";
import { BotBase } from "./botbase";
import { DuelBot, DuelAccepted, DuelImpl } from "./duelbot";

function blackJackDuelImplConfig() {
  return {
    deckGenerator: BlackJackDuelImpl.shuffledDeckGenerator,
    gameBrain: new blackjackModule.BlackJackBrain(
      0.1
    ) as GameBrain<blackjackModule.BlackJack>,
  };
}

@ConfigName("BlackJackDuelImpl", blackJackDuelImplConfig)
class BlackJackDuelImpl
  extends DuelImpl<blackjackModule.BlackJack>
  implements Configurable
{
  readonly handlers = {};
  readonly bindMoves = {
    hitBJ: {
      description: "Pull a card",
      format: "",
    },
    standBJ: {
      description: "Stand and end your turn",
      format: "",
    },
  };
  readonly duelDescription: string = "blackjack duel";
  readonly gameBrain: GameBrain<blackjackModule.BlackJack>;

  readonly deckGenerator: () => blackjackModule.Deck;
  static shuffledDeckGenerator(): blackjackModule.Deck {
    const deck = new blackjackModule.Deck();
    deck.shuffle();
    return deck;
  }

  constructor(config: MappedSchemaFromGet<typeof blackJackDuelImplConfig>) {
    super();
    this.deckGenerator = config.deckGenerator;
    this.gameBrain = config.gameBrain;
  }

  override printDuelIntro(
    bot: DuelBot,
    context: HandlerContext,
    duel: DuelAccepted<blackjackModule.BlackJack>
  ): string {
    return `${bot.addressUser(
      context,
      duel.payload.players[0]
    )} is first to play!`;
  }

  override printDuelStatus(
    bot: DuelBot,
    context: HandlerContext,
    duel: DuelAccepted<blackjackModule.BlackJack>,
    moreInfo: boolean
  ): string {
    if (!moreInfo) {
      return "";
    }
    const players = [duel.userId1, duel.userId2];
    return BotBase.appendMsg(
      players
        .map(
          (userId) =>
            `${bot.addressUser(context, userId)}'s hand: ${duel.payload.hands[
              userId
            ].toString()}` +
            `, totaling ${blackjackModule.BlackJack.getBalance(
              duel.payload.hands[userId]
            )}`
        )
        .join(";\n") + ".",
      this.listMoves(bot),
      "\n"
    );
  }

  override printDuelPrompt(
    bot: DuelBot,
    context: HandlerContext,
    duel: DuelAccepted<blackjackModule.BlackJack>,
    moreInfo: boolean
  ): string {
    return `${bot.addressUser(
      context,
      duel.payload.getCurrentPlayer()
    )}, your move!`;
  }

  override printDuelResult(
    bot: DuelBot,
    context: HandlerContext,
    duel: DuelAccepted<blackjackModule.BlackJack>,
    moreInfo: boolean,
    result: GameResult
  ): string {
    return "";
  }

  override createDuelPayload(
    bot: DuelBot,
    players: string[]
  ): blackjackModule.BlackJack {
    return new blackjackModule.BlackJack(players, this.deckGenerator());
  }
}
