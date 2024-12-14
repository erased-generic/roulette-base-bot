import { Game, GameContext, GameMoveResult, GameResult } from "./interfaces";
import * as fs from 'fs';
export { Anagrams };

interface GuessResult extends GameMoveResult {
  score: number;
  words: string[];
}

class Anagrams implements Game {
  readonly moveHandlers = {
    'an': this.guessAnagram.bind(this),
  };

  players: string[] = [];
  scores: { [key: string]: number } = {};
  anagrams = {};
  randomizer: () => number = undefined;
  unguessed: string[] = [];

  constructor(players: string[], num_to_guess: number, anagrams: { [key: string]: string[] }, randomizer: () => number = () => Math.random()) {
    this.players = players;
    this.anagrams = anagrams;
    this.randomizer = randomizer;
    for (const player of players) {
      this.scores[player] = 0;
    }

    while (this.unguessed.length < num_to_guess) {
      let word = Object.keys(this.anagrams)[Math.floor(this.randomizer() * Object.keys(this.anagrams).length)];
      if (!this.unguessed.includes(word)) {
        this.unguessed.push(word);
      }
    }
  }

  init(): undefined {
  }

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
    const potential_anagrams = this.anagrams[guess] || [];
    const guessed_anagrams = [];
    for (const anagram of potential_anagrams) {
      if (this.unguessed.includes(anagram)) {
        this.unguessed.splice(this.unguessed.indexOf(anagram), 1);
        guessed_anagrams.push(anagram);
        this.scores[player]++;
      }
    }

    return {
      result: this.isFinal() ? this.calcResult() : undefined,
      score: this.scores[player],
      words: guessed_anagrams,
      describe: (context: GameContext): string => {
        const username = context.getUsername(player);
        let msg = `${username} `;
        let balanceMsg = ``;
        if (guessed_anagrams.length == 0) {
          msg += `did not guess any anagrams`;
          balanceMsg = `still`;
        } else if (guessed_anagrams.length == 1) {
          msg += `guessed ${guessed_anagrams[0]}`;
          balanceMsg = `now`;
        } else {
          msg += `guessed ${guessed_anagrams.length} anagrams: ${guessed_anagrams.join(', ')}`;
          balanceMsg = `now`;
        }
        msg += `; they ${balanceMsg} have ${this.scores[player]} points!`;
        console.log(
          `* guessAnagram: ${player} ${username} ${guess} - ${guessed_anagrams.toString()} (${this.scores[player]})`
        );
        return msg;
      },
    };
  }
}
