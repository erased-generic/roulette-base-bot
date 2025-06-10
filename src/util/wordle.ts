import { Game, GameContext, GameMoveResult, GameResult } from "./interfaces";
export { LetterState, Wordle };

enum LetterState {
  Wrong,
  WrongPosition,
  Correct
}

interface GuessResult extends GameMoveResult {
  guess: string;
}

interface ValidGuessResult extends GuessResult {
  letters: LetterState[];
}

class Wordle implements Game {
  readonly moveHandlers = {
    wordleGuess: this.guessWord.bind(this),
  };

  readonly validTargets: string[];
  readonly validGuesses: string[];
  readonly randomizer: () => number;
  readonly players: string[];
  readonly target: string;
  readonly maxTurns: number;
  readonly history: ValidGuessResult[] = [];

  constructor(
    players: string[],
    validTargets: string[],
    validGuesses: string[],
    maxTurns: number = 0,
    randomizer: () => number = () => Math.random()
  ) {
    this.validTargets = validTargets;
    this.validGuesses = validGuesses;
    this.randomizer = randomizer;
    this.players = players;
    this.target =
      validTargets[Math.floor(this.randomizer() * validTargets.length)];
    this.maxTurns = maxTurns;
  }

  init(): undefined {}

  isCurrentPlayer(playerId: string): boolean {
    return true;
  }

  getPlayers(): string[] {
    return this.players;
  }

  private static calcLetterStates(
    guess: string,
    target: string
  ): LetterState[] {
    const states: LetterState[] = new Array(guess.length).fill(
      LetterState.Wrong
    );
    const unmatched: string[] = [];
    for (let i = 0; i < guess.length; i++) {
      if (guess[i] === target[i]) {
        states[i] = LetterState.Correct;
      } else {
        unmatched.push(target[i]);
      }
    }
    for (let i = 0; i < guess.length; i++) {
      if (states[i] === LetterState.Wrong) {
        if (unmatched.includes(guess[i])) {
          states[i] = LetterState.WrongPosition;
          unmatched.splice(unmatched.indexOf(guess[i]), 1);
        }
      }
    }

    return states;
  }

  private calcResult(player: string, guess: string): GameResult | undefined {
    if (guess === this.target) {
      return {
        ranking: [[player], this.players.filter((p) => p !== player)],
      };
    } else if (this.maxTurns > 0 && this.history.length >= this.maxTurns) {
      return {
        ranking: [this.players.filter((p) => p !== player), [player]],
      };
    }
    return undefined;
  }

  guessWord(player: string, args: string[]): GuessResult {
    const guess = args[1].toLowerCase();
    if (!this.validGuesses.includes(guess)) {
      return {
        result: undefined,
        guess: guess,
        describe: (context: GameContext): string => {
          return `Not a word: ${guess}`;
        },
      };
    }

    const letterStates = Wordle.calcLetterStates(guess, this.target);

    const result = {
      guess: guess,
      letters: letterStates,
      describe: (context: GameContext): string => {
        const username = context.getUsername(player);
        let msg = `${username} guessed: ${Wordle.renderLetterStates(
          guess,
          letterStates
        )}!`;
        if (this.maxTurns > 0 && guess !== this.target) {
          msg += ` You have ${this.maxTurns - this.history.length} guesses left.`;
        }
        console.log(
          `* guessWordle: ${player} ${username} ${guess} - ${Wordle.renderLetterStates(
            guess,
            letterStates
          )}`
        );
        return msg;
      },
    } as ValidGuessResult;
    this.history.push(result);
    result.result = this.calcResult(player, guess);
    return result;
  }

  static readonly WRONG_LETTERS = [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    "W",
    "X",
    "Y",
    "Z",
  ];
  static readonly WRONG_POSITION_LETTERS = [
    "🄐",
    "🄑",
    "🄒",
    "🄓",
    "🄔",
    "🄕",
    "🄖",
    "🄗",
    "🄘",
    "🄙",
    "🄚",
    "🄛",
    "🄜",
    "🄝",
    "🄞",
    "🄟",
    "🄠",
    "🄡",
    "🄢",
    "🄣",
    "🄤",
    "🄥",
    "🄦",
    "🄧",
    "🄨",
    "🄩",
  ];
  static readonly CORRECT_LETTERS = [
    "🅰",
    "🅱",
    "🅲",
    "🅳",
    "🅴",
    "🅵",
    "🅶",
    "🅷",
    "🅸",
    "🅹",
    "🅺",
    "🅻",
    "🅼",
    "🅽",
    "🅾",
    "🅿",
    "🆀",
    "🆁",
    "🆂",
    "🆃",
    "🆄",
    "🆅",
    "🆆",
    "🆇",
    "🆈",
    "🆉",
  ];

  static renderLetterState(letter: string, state: LetterState): string {
    const charCode = letter.codePointAt(0)!;
    const A_CHAR_CODE = "a".codePointAt(0)!;
    const Z_CHAR_CODE = "z".codePointAt(0)!;
    if (charCode < A_CHAR_CODE || charCode > Z_CHAR_CODE) {
      return letter;
    }

    const offset = charCode - A_CHAR_CODE;
    switch (state) {
      case LetterState.Wrong:
        return Wordle.WRONG_LETTERS[offset];
      case LetterState.WrongPosition:
        return Wordle.WRONG_POSITION_LETTERS[offset];
      case LetterState.Correct:
        return Wordle.CORRECT_LETTERS[offset];
    }
  }

  static renderLetterStates(
    guess: string,
    letterStates: LetterState[]
  ): string {
    return guess
      .split("")
      .map((letter, i) => Wordle.renderLetterState(letter, letterStates[i]))
      .join("");
  }
}
