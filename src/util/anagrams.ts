import { Game, GameContext, GameMoveResult, GameResult } from "./interfaces";
export { Anagrams };

interface GuessResult extends GameMoveResult {
  score: number;
  words: string[];
}

enum HintState {
  None,
  Ends,
  EndsWithMiddle,
  EndsWithTwoMiddle,
}

class Hint {
  anagram: string;
  state: HintState;
}

class Anagrams implements Game {
  readonly moveHandlers = {
    an: this.guessAnagram.bind(this),
  };

  readonly anagrams = {};
  readonly randomizer: () => number = undefined;
  readonly players: string[] = [];
  readonly scores: { [key: string]: number } = {};
  readonly unguessed: string[] = [];
  readonly hints: { [key: string]: Hint } = {};

  constructor(
    players: string[],
    numToGuess: number,
    anagrams: { [key: string]: string[] },
    randomizer: () => number = () => Math.random()
  ) {
    this.anagrams = anagrams;
    this.randomizer = randomizer;
    this.players = players;
    for (const player of players) {
      this.scores[player] = 0;
    }

    while (this.unguessed.length < numToGuess) {
      let word = Object.keys(this.anagrams)[
        Math.floor(this.randomizer() * Object.keys(this.anagrams).length)
      ];
      if (!this.unguessed.includes(word)) {
        this.unguessed.push(word);
      }
    }
  }

  init(): undefined {}

  isCurrentPlayer(playerId: string): boolean {
    return true;
  }

  isFinal(): boolean {
    if (this.unguessed.length == 0) {
      return true;
    }

    const sortedScores = Object.values(this.scores).sort((a, b) => a - b);
    for (let i = 0; i < sortedScores.length - 1; i++) {
      const delta = sortedScores[i + 1] - sortedScores[i];
      if (delta <= this.unguessed.length) {
        // player standings may change
        return false;
      }
    }
    // player standings can't change
    return true;
  }

  calcResult(): GameResult {
    let ranking: { [key: number]: string[] } = {};
    for (const player of this.players) {
      const score = this.scores[player];
      ranking[score] ||= [];
      ranking[score].push(player);
    }
    return {
      ranking: Object.entries(ranking)
        .map(([k, v]) => ({ balance: Number(k), players: v }))
        .sort((a, b) => b.balance - a.balance)
        .map((x) => x.players.sort()),
    };
  }

  getPlayers(): string[] {
    return this.players;
  }

  guessAnagram(player: string, args: string[]): GuessResult {
    const guess = args[1];
    const potentialAnagrams = this.anagrams[guess] || [];
    const guessedAnagrams = [];
    for (const anagram of potentialAnagrams) {
      if (this.unguessed.includes(anagram)) {
        this.unguessed.splice(this.unguessed.indexOf(anagram), 1);
        guessedAnagrams.push(anagram);
        this.scores[player]++;
      }
    }

    return {
      result: this.isFinal() ? this.calcResult() : undefined,
      score: this.scores[player],
      words: guessedAnagrams,
      describe: (context: GameContext): string => {
        const username = context.getUsername(player);
        let msg = `${username} `;
        let balanceMsg = ``;
        if (guessedAnagrams.length == 0) {
          msg += `did not guess any anagrams`;
          balanceMsg = `still`;
        } else if (guessedAnagrams.length == 1) {
          msg += `guessed ${guessedAnagrams[0]}`;
          balanceMsg = `now`;
        } else {
          msg += `guessed ${
            guessedAnagrams.length
          } anagrams: ${guessedAnagrams.join(", ")}`;
          balanceMsg = `now`;
        }
        msg += `; they ${balanceMsg} have ${this.scores[player]} points!`;
        console.log(
          `* guessAnagram: ${player} ${username} ${guess} - ${guessedAnagrams.toString()} (${
            this.scores[player]
          })`
        );
        return msg;
      },
    };
  }

  static maskWordPos(word: string, unmaskIndices: number[]): string {
    let masked = "_".repeat(word.length);
    for (const index of unmaskIndices) {
      masked =
        masked.substring(0, index) + word[index] + masked.substring(index + 1);
    }
    return masked;
  }

  static maskWord(word: string, hintState: HintState): string {
    let unmaskIndices = [];
    switch (hintState) {
      case HintState.EndsWithTwoMiddle:
        unmaskIndices.push(Math.floor((word.length - 1) / 2) + 1);
      case HintState.EndsWithMiddle:
        unmaskIndices.push(Math.floor((word.length - 1) / 2));
      case HintState.Ends:
        unmaskIndices.push(0);
        unmaskIndices.push(word.length - 1);
      case HintState.None:
        break;
    }
    return Anagrams.maskWordPos(
      word,
      unmaskIndices
        .filter((x) => x >= 0 && x < word.length)
        .slice(-(word.length - 1))
    );
  }

  getHint(args: string[]): { word: string; hint?: string } {
    if (this.unguessed.length == 0) {
      return undefined;
    }
    let word =
      this.unguessed[Math.floor(Math.random() * this.unguessed.length)];
    if (args.length >= 2 && this.unguessed.includes(args[1])) {
      word = args[1];
    }
    if (!(word in this.hints)) {
      const potentialAnagrams = this.anagrams[word] || [];
      const anagram =
        potentialAnagrams[
          Math.floor(Math.random() * potentialAnagrams.length)
        ];
      this.hints[word] = { anagram: anagram, state: HintState.None };
    }
    const hint = this.hints[word];
    switch (hint.state) {
      case HintState.None:
        hint.state = HintState.Ends;
        break;
      case HintState.Ends:
        hint.state = HintState.EndsWithMiddle;
        break;
      case HintState.EndsWithMiddle:
        hint.state = HintState.EndsWithTwoMiddle;
        break;
      case HintState.EndsWithTwoMiddle:
        break;
    }
    return {
      word: word,
      hint: Anagrams.maskWord(hint.anagram, hint.state),
    };
  }
}
