import * as wordleModule from "../util/wordle";
import {
  MappedSchemaFromGet,
  ConfigName,
  Configurable,
  GameBrain,
  GameResult,
  noDefaultValue,
  RejectingBrain,
} from "../util/interfaces";
import { BotBase } from "./botbase";
import { DuelBot, DuelAccepted, DuelImpl, DuelHandler } from "./duelbot";
import * as fs from "fs";

export { DoNothingBrain, wordleDuelImplConfig, WordleDuelImpl };

class DoNothingBrain extends RejectingBrain<wordleModule.Wordle> {
  constructor(chance: number = 0) {
    super(chance);
  }
}

function wordleDuelImplConfig() {
  return {
    validWordleTargets: noDefaultValue(String),
    validWordleGuesses: noDefaultValue(String),
    validWordleDataIsFile: true,
    gameBrain: new DoNothingBrain(0.1) as GameBrain<wordleModule.Wordle>,
    randomizer: () => Math.random(),
  };
}

@ConfigName("WordleDuelImpl", wordleDuelImplConfig)
class WordleDuelImpl
  extends DuelImpl<wordleModule.Wordle>
  implements Configurable
{
  readonly handlers: { [key: string]: DuelHandler } = {};
  readonly bindMoves = {
    wordleGuess: {
      description: "Guess a wordle word",
      format: "<your guess>",
    },
  };
  readonly duelDescription: string = "wordle duel";
  readonly gameBrain?: GameBrain<wordleModule.Wordle>;
  readonly validWordleTargets: string[] = [];
  readonly validWordleGuesses: string[] = [];
  readonly randomizer: () => number;

  constructor(config: MappedSchemaFromGet<typeof wordleDuelImplConfig>) {
    super();
    if (config.validWordleDataIsFile) {
      this.validWordleTargets = JSON.parse(
        fs.readFileSync(config.validWordleTargets.valueOf()).toString()
      );
      this.validWordleGuesses = JSON.parse(
        fs.readFileSync(config.validWordleGuesses.valueOf()).toString()
      );
    } else {
      this.validWordleTargets = JSON.parse(config.validWordleTargets.valueOf());
      this.validWordleGuesses = JSON.parse(config.validWordleGuesses.valueOf());
    }
    this.gameBrain = config.gameBrain;
    this.randomizer = config.randomizer;
  }

  override printDuelIntro(
    bot: DuelBot,
    duel: DuelAccepted<wordleModule.Wordle>
  ): string {
    return `Legend: ${wordleModule.Wordle.renderLetterState(
      "a",
      wordleModule.LetterState.Wrong
    )} is a wrong letter, ${wordleModule.Wordle.renderLetterState(
      "a",
      wordleModule.LetterState.WrongPosition
    )} is in the wrong position, ${wordleModule.Wordle.renderLetterState(
      "a",
      wordleModule.LetterState.Correct
    )} is correct.`;
  }

  override printDuelStatus(
    bot: DuelBot,
    duel: DuelAccepted<wordleModule.Wordle>,
    moreInfo: boolean
  ): string {
    if (!moreInfo) {
      return "";
    }
    let msg = "";
    if (duel.payload.history.length > 0) {
      msg += "Guess history: ";
      msg += duel.payload.history
        .map(
          (guess) =>
            `${wordleModule.Wordle.renderLetterStates(
              guess.guess,
              guess.letters
            )}`
        )
        .join("\n");
    }
    msg = BotBase.appendMsg(msg, this.listMoves(bot), "\n");
    return msg;
  }

  override printDuelPrompt(
    bot: DuelBot,
    duel: DuelAccepted<wordleModule.Wordle>,
    moreInfo: boolean
  ): string {
    return "";
  }

  override printDuelResult(
    bot: DuelBot,
    duel: DuelAccepted<wordleModule.Wordle>,
    moreInfo: boolean,
    result: GameResult
  ): string {
    return "";
  }

  override createDuelPayload(
    bot: DuelBot,
    players: string[]
  ): wordleModule.Wordle {
    return new wordleModule.Wordle(
      players,
      this.validWordleTargets,
      this.validWordleGuesses,
      players.includes(bot.botContext.botUsername) ? 6 : 0,
      this.randomizer
    );
  }
}
