import * as anagramsModule from "../util/anagrams";
import { UserData } from "../util/userdata";
import { Bot, BotHandler, ChatContext, GameBrain, GameResult } from "../util/interfaces";
import { BotBase, BotBaseContext, PerUserData } from "./botbase";
import { DuelBot, DuelAccepted, DuelImpl, DuelMove, DuelHandler } from "./duelbot";
import * as fs from "fs";

export { AnagramsDuelImpl };

class AnagramsDuelImpl extends DuelImpl<anagramsModule.Anagrams> {
  readonly handlers: { [key: string]: DuelHandler } = {
    hint: {
      action: this.getHint.bind(this),
      description: "Get a hint for a random word",
      format: "",
    }
  };
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

  static maskWord(word: string): string {
    if (word.length <= 2) {
      return word;
    }
    return word[0] + "_".repeat(word.length - 2) + word[word.length - 1];
  }

  getHint(bot: DuelBot, context: ChatContext, args: string[]): string | undefined {
    const userId = context["user-id"];
    const duel = bot.duels[userId];
    if (duel && duel instanceof DuelAccepted) {
      const payload: anagramsModule.Anagrams = duel.payload;
      if (!payload.unguessed.length) {
        return "Invalid duel (how did you get here?)";
      }
      const word = payload.unguessed[Math.floor(Math.random() * payload.unguessed.length)];
      const potential_anagrams = this.anagrams[word] || [];
      const anagram = potential_anagrams[Math.floor(Math.random() * potential_anagrams.length)];
      return `Hint: an answer for ${word} looks like ${AnagramsDuelImpl.maskWord(anagram)}!`;
    }
    return "No duel - no hint!";
  }
}
