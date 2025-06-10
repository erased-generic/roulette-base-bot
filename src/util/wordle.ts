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
  letters: LetterState[]
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
  readonly history: ValidGuessResult[] = [];

  constructor(
    players: string[],
    validTargets: string[],
    validGuesses: string[],
    randomizer: () => number = () => Math.random()
  ) {
    this.validTargets = validTargets;
    this.validGuesses = validGuesses;
    this.randomizer = randomizer;
    this.players = players;
    this.target =
      validTargets[Math.floor(this.randomizer() * validTargets.length)];
  }

  init(): undefined {}

  isCurrentPlayer(playerId: string): boolean {
    return true;
  }

  getPlayers(): string[] {
    return this.players;
  }

  private static calcLetterStates(guess: string, target: string): LetterState[] {
    const states: LetterState[] = [];
    for (let i = 0; i < guess.length; i++) {
      if (guess[i] === target[i]) {
        states.push(LetterState.Correct);
      } else if (target.includes(guess[i])) {
        states.push(LetterState.WrongPosition);
      } else {
        states.push(LetterState.Wrong);
      }
    }
    return states;
  }

  private calcResult(playerWon: string): GameResult {
    return {
      ranking: [[playerWon], this.players.filter((p) => p !== playerWon)],
    };
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

    return {
      guess: guess,
      result: guess === this.target ? this.calcResult(player) : undefined,
      letters: letterStates,
      describe: (context: GameContext): string => {
        const username = context.getUsername(player);
        let msg = `${username} guessed: ${Wordle.renderLetterStates(
          guess,
          letterStates
        )}!`;
        console.log(
          `* guessWordle: ${player} ${username} ${guess} - ${Wordle.renderLetterStates(
            guess,
            letterStates
          )}`
        );
        return msg;
      },
    } as ValidGuessResult;
  }

  static readonly WRONG_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
  static readonly WRONG_POSITION_LETTERS = ["🄐", "🄑", "🄒", "🄓", "🄔", "🄕", "🄖", "🄗", "🄘", "🄙", "🄚", "🄛", "🄜", "🄝", "🄞", "🄟", "🄠", "🄡", "🄢", "🄣", "🄤", "🄥", "🄦", "🄧", "🄨", "🄩"];
  static readonly CORRECT_LETTERS = ["🅰", "🅱", "🅲", "🅳", "🅴", "🅵", "🅶", "🅷", "🅸", "🅹", "🅺", "🅻", "🅼", "🅽", "🅾", "🅿", "🆀", "🆁", "🆂", "🆃", "🆄", "🆅", "🆆", "🆇", "🆈", "🆉"];

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

  static renderLetterStates(guess: string, letterStates: LetterState[]): string {
    return guess
      .split("")
      .map((letter, i) => Wordle.renderLetterState(letter, letterStates[i]))
      .join("");
  }
}
