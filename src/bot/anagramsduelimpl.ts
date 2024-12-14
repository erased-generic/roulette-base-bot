import * as anagramsModule from "../util/anagrams";
import { UserData } from "../util/userdata";
import { Bot, BotHandler, GameBrain, GameResult } from "../util/interfaces";
import { BotBase, BotBaseContext, PerUserData } from "./botbase";
import { DuelBot, DuelAccepted, DuelImpl, DuelMove } from "./duelbot";
import * as fs from "fs";

export { AnagramsDuelImpl };

class AnagramsDuelImpl extends DuelImpl<anagramsModule.Anagrams> {
  readonly bindMoves: { [key: string]: DuelMove } = {
    an: {
      description: "Guess an anagram of the input words",
      format: "<your guess>",
    },
  };
  readonly duelDescription: string = "anagrams duel";
  readonly gameBrain: GameBrain<anagramsModule.Anagrams>;
  readonly anagrams: { [key: string]: string[] };
  readonly numToGuess: number;
  readonly randomizer: () => number;

  constructor(
    anagrams: string | { [key: string]: string[] },
    numToGuess: number = 5,
    gameBrain: GameBrain<anagramsModule.Anagrams> | undefined = undefined,
    randomizer: () => number = () => Math.random()
  ) {
    super();
    if (typeof anagrams === "string") {
      this.anagrams = JSON.parse(fs.readFileSync(anagrams).toString());
    } else {
      this.anagrams = anagrams;
    }
    this.numToGuess = numToGuess;
    this.gameBrain = gameBrain;
    this.randomizer = randomizer;
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
    msg = BotBase.appendMsg(msg, `Type ${bot.botContext.cmdMarker}an ${this.bindMoves["an"].format} to guess!`, '\n');
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
}
