import * as blackjackModule from "../util/blackjack";
import { UserData } from "../util/userdata";
import { Bot, BotHandler, GameBrain, GameResult } from "../util/interfaces";
import { BotBaseContext, PerUserData } from "./botbase";
import { DuelBot, DuelAccepted } from "./duelbot";

export { BlackJackDuelBot };

class BlackJackDuelBot
  extends DuelBot<blackjackModule.BlackJack>
  implements Bot
{
  readonly handlers: { [key: string]: BotHandler } = {
    duel: {
      action: this.duelHandler.bind(this),
      description:
        "Blackjack duel interface. Request a duel with another user (they still need to accept it). " +
        "Multiple concurrent duels are supported",
      format: "<amount of points> <opponent username>",
    },
    accept: {
      action: this.acceptHandler.bind(this),
      description:
        "Blackjack duel interface. Accept a duel request from another user. If you don't have enough points, you go all-in",
      format: "[<opponent username>]",
    },
    hit: {
      action: this.moveHandler.bind(this, "hit"),
      description: "Blackjack duel interface. Pull a card",
      format: "",
    },
    stand: {
      action: this.moveHandler.bind(this, "stand"),
      description: "Blackjack duel interface. Stand and end your turn",
      format: "",
    },
    unduel: {
      action: this.unduelHandler.bind(this),
      description:
        "Blackjack duel interface. Retract all your dueling requests and forfeit any ongoing duels",
      format: "",
    },
    rendezvous: {
      action: this.rendezvousHandler.bind(this),
      description:
        "Blackjack duel interface. View all ongoing duels and duel requests",
      format: "",
    },
    check: {
      action: this.checkHandler.bind(this),
      description: "Blackjack duel interface. View your current duel status",
      format: "",
    },
  };

  readonly deckGenerator: () => blackjackModule.Deck;
  static shuffledDeckGenerator(): blackjackModule.Deck {
    const deck = new blackjackModule.Deck();
    deck.shuffle();
    return deck;
  }

  constructor(
    botContext: BotBaseContext,
    playerShuffleChance: number = 0.5,
    deckGenerator: () => blackjackModule.Deck = BlackJackDuelBot.shuffledDeckGenerator,
    gameBrain:
      | GameBrain<blackjackModule.BlackJack>
      | undefined = new blackjackModule.BlackJackBrain(0.1)
  ) {
    super(botContext, playerShuffleChance, "blackjack duel", gameBrain);
    this.deckGenerator = deckGenerator;
  }

  protected override printDuelIntro(
    duel: DuelAccepted<blackjackModule.BlackJack>
  ): string {
    return "";
  }

  protected override printDuelStatus(
    duel: DuelAccepted<blackjackModule.BlackJack>,
    moreInfo: boolean
  ): string {
    if (!moreInfo) {
      return "";
    }
    const players = [duel.userId1, duel.userId2];
    return (
      players
        .map(
          (userId) =>
            `${this.getUsername(userId)}'s hand: ${duel.payload.hands[
              userId
            ].toString()}` +
            `, totaling ${blackjackModule.BlackJack.getBalance(
              duel.payload.hands[userId]
            )}`
        )
        .join(";\n") + "."
    );
  }

  protected override printDuelPrompt(
    duel: DuelAccepted<blackjackModule.BlackJack>,
    moreInfo: boolean
  ): string {
    return `${this.getUsername(
      duel.payload.getCurrentPlayer()
    )}, your move! Type ${this.botContext.cmdMarker}hit or ${
      this.botContext.cmdMarker
    }stand!`;
  }

  protected override printDuelResult(
    duel: DuelAccepted<blackjackModule.BlackJack>,
    moreInfo: boolean,
    result: GameResult
  ): string {
    return "";
  }

  protected override createDuelPayload(
    players: string[]
  ): blackjackModule.BlackJack {
    return new blackjackModule.BlackJack(players, this.deckGenerator());
  }
}
