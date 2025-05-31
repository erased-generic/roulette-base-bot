export { Bet, RouletteBase, Roulette, Prediction };
import Fraction from "fraction.js";

interface Bet {
  amount: number;
  numbers: number[];
}

abstract class RouletteBase {
  // Object to store players and their bets
  bets: { [key: string]: Bet };
  // Last winning number
  lastNumber: number;
  // All betting places
  allNumbers: number[];
  // Casino's edge
  edge: Fraction;

  static getAllNumbers(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  constructor(n: number, edge: Fraction) {
    this.bets = {};
    this.lastNumber = NaN;
    this.edge = edge;
    this.allNumbers = RouletteBase.getAllNumbers(n);
  }

  // Method to accept bets from players
  placeBet(playerId: string, betAmount: number, betNumbers: number[]): void | string {
    this.bets[playerId] = { amount: betAmount, numbers: betNumbers };
  }

  // Method to remove a bet from a player
  unplaceBet(playerId: string) {
    delete this.bets[playerId];
  }

  // Method to get a player's bet
  getBet(playerId: string): number | undefined {
    const bet = this.bets[playerId];
    if (bet !== undefined) {
      return bet.amount;
    }
    return undefined;
  }

  // Method to run the roulette and get the winning number
  runRoulette() {
    const winningNumber = this.allNumbers[Math.floor(Math.random() * this.allNumbers.length)];
    return this.lastNumber = winningNumber;
  }

  // Compute the chance of winning (note: may depend on this.lastNumber)
  abstract allNumberChances(): { chances: Fraction[], rescaled: boolean };

  // Method to compute winnings for each player based on the last winning number
  computeWinnings(callback: (playerId: string, didWin: boolean, chance: Fraction, amount: number, payout: Fraction) => void) {
    // For each number in allNumbers, compute the chance of winning
    const allChances = this.allNumberChances();
    for (const playerId in this.bets) {
      const playerBet = this.bets[playerId];
      let chance = new Fraction(0);
      for (const i of playerBet.numbers) {
        chance = chance.add(allChances.chances[i]);
      }
      let payout = new Fraction(-playerBet.amount);
      const didWin = playerBet.numbers.includes(this.lastNumber);
      if (didWin) {
        // 1 for rescaled to allow winning when going all-in with 0 points
        payout = payout.add(
          new Fraction(allChances.rescaled ? 1 : playerBet.amount)
            .div(playerBet.numbers.length)
            .mul(new Fraction(1).sub(this.edge))
            .div(allChances.chances[this.lastNumber])
        );
      }
      callback(playerId, didWin, chance, playerBet.amount, payout);
    }
    // Reset players' bets for the next round
    this.reset();
  }

  // Method to reset players' bets
  reset() {
    this.bets = {};
  }
}

// Roulette class
class Roulette extends RouletteBase {
  constructor(n: number) {
    super(n, new Fraction(n).inverse());
  }

  // Method to calculate independent winning chance
  allNumberChances(): { chances: Fraction[], rescaled: boolean } {
    return { chances: this.allNumbers.map(() => new Fraction(this.allNumbers.length).inverse()), rescaled: false };
  }
}

// Predictions class
class Prediction extends RouletteBase {
  constructor(n: number) {
    super(n, new Fraction(0));
  }

  static readonly INFTY: Fraction = new Fraction(BigInt(Number.MAX_VALUE) + BigInt(1));

  // Method to calculate prediction winning chance
  allNumberChances(): { chances: Fraction[], rescaled: boolean } {
    let sum = new Fraction(0);
    let bets = this.allNumbers.map(() => new Fraction(0));
    for (const playerId in this.bets) {
      sum = sum.add(this.bets[playerId].amount);
      for (const i of this.bets[playerId].numbers) {
        bets[i] = bets[i].add(
          new Fraction(this.bets[playerId].amount).div(
            this.bets[playerId].numbers.length
          )
        );
      }
    }

    if (Object.keys(this.bets).length === 0) {
      // no players
      return { chances: this.allNumbers.map(() => new Fraction(0)), rescaled: false };
    } else if (sum.equals(0)) {
      // amounts are 0 anyway, just make chances something that makes sense:
      // as if each player bet 1 in total
      for (const playerId in this.bets) {
        sum = sum.add(1);
        for (const i of this.bets[playerId].numbers) {
          bets[i] = bets[i].add(
            new Fraction(this.bets[playerId].numbers.length).inverse()
          );
        }
      }
      return { chances: bets.map(b => b.div(sum)), rescaled: false };
    } else if (bets[this.lastNumber].equals(0)) {
      // now we need to distinguish different 0-chance bets, rescale everything
      let rescale = new Fraction(0);
      for (const playerId in this.bets) {
        if (this.bets[playerId].numbers.includes(this.lastNumber)) {
          rescale = rescale.add(
            new Fraction(this.bets[playerId].numbers.length).inverse()
          );
        }
      }
      bets.fill(Prediction.INFTY);
      bets[this.lastNumber] = rescale.div(sum);
      return { chances: bets, rescaled: true };
    } else {
      return { chances: bets.map(b => b.div(sum)), rescaled: false };
    }
  }
}
