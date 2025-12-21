import * as anagramsModule from "../util/anagrams";
import {
  ChatContext,
  MappedSchemaFromGet,
  ConfigName,
  Configurable,
  GameBrain,
  GameResult,
  noDefaultValue,
  optionalValue,
} from "../util/interfaces";
import { BotBase } from "./botbase";
import { DuelBot, DuelAccepted, DuelImpl, DuelHandler } from "./duelbot";
import * as fs from "fs";

export { anagramsDuelImplConfig, AnagramsDuelImpl };

function anagramsDuelImplConfig() {
  return {
    anagrams: noDefaultValue(String),
    anagramsIsFile: true,
    numToGuess: 5,
    gameBrain: optionalValue(GameBrain<anagramsModule.Anagrams>),
    randomizer: () => Math.random(),
  };
}

@ConfigName("AnagramsDuelImpl", anagramsDuelImplConfig)
class AnagramsDuelImpl
  extends DuelImpl<anagramsModule.Anagrams>
  implements Configurable
{
  readonly handlers: { [key: string]: DuelHandler } = {
    hint: {
      action: this.getHint.bind(this),
      description:
        "Get a hint for a specific word or a random word if none was specified",
      format: "[<the word>]",
    },
  };
  readonly bindMoves = {
    anagramGuess: {
      description: "Guess an anagram of the input words",
      format: "<your guess>",
    },
  };
  readonly duelDescription: string = "anagrams duel";
  readonly gameBrain?: GameBrain<anagramsModule.Anagrams>;
  readonly anagrams: { [key: string]: string[] };
  readonly numToGuess: number;
  readonly randomizer: () => number;

  constructor(config: MappedSchemaFromGet<typeof anagramsDuelImplConfig>) {
    super();
    const anagramsJSON = config.anagramsIsFile
      ? fs.readFileSync(config.anagrams.valueOf()).toString()
      : config.anagrams.valueOf();
    this.anagrams = JSON.parse(anagramsJSON);
    this.numToGuess = config.numToGuess;
    this.gameBrain = config.gameBrain;
    this.randomizer = config.randomizer;
  }

  override printDuelIntro(
    bot: DuelBot,
    duel: DuelAccepted<anagramsModule.Anagrams>
  ): string {
    return "";
  }

  override printDuelStatus(
    bot: DuelBot,
    duel: DuelAccepted<anagramsModule.Anagrams>,
    moreInfo: boolean
  ): string {
    if (!moreInfo) {
      return "";
    }
    const players = [duel.userId1, duel.userId2];
    let msg = "";
    if (!Object.values(duel.payload.scores).every((score) => score === 0)) {
      msg +=
        players
          .map(
            (userId) =>
              `${bot.getUsername(userId)}'s score: ${
                duel.payload.scores[userId]
              }`
          )
          .join(",\n") + ".";
    }
    msg = BotBase.appendMsg(msg, this.listMoves(bot), "\n");
    return msg;
  }

  override printDuelPrompt(
    bot: DuelBot,
    duel: DuelAccepted<anagramsModule.Anagrams>,
    moreInfo: boolean
  ): string {
    return `These words are left: ${duel.payload.unguessed.join(", ")}.`;
  }

  override printDuelResult(
    bot: DuelBot,
    duel: DuelAccepted<anagramsModule.Anagrams>,
    moreInfo: boolean,
    result: GameResult
  ): string {
    return "";
  }

  override createDuelPayload(
    bot: DuelBot,
    players: string[]
  ): anagramsModule.Anagrams {
    return new anagramsModule.Anagrams(
      players,
      this.numToGuess,
      this.anagrams,
      this.randomizer
    );
  }

  getHint(
    bot: DuelBot,
    context: ChatContext,
    args: string[]
  ): string | undefined {
    const userId = context["user-id"];
    const duel = bot.duels[userId];
    if (duel && duel instanceof DuelAccepted) {
      const payload: anagramsModule.Anagrams = duel.payload;
      const hint = payload.getHint(args);
      if (hint === undefined) {
        return "Hint: you're on your own!";
      }
      return `Hint: an answer for ${hint.word} looks like ${hint.hint}!`;
    }
    return "No duel - no hint!";
  }
}
