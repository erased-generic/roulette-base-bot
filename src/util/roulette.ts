export { Bet, Infty, FractionOrInf, RouletteBase, Roulette, Prediction };
import Fraction from "fraction.js";

interface Bet {
  amount: number;
  numbers: number[];
}

class Infty {
  static readonly value = new Infty();
  private constructor() {}
}
type FractionOrInf = Fraction | Infty;

abstract class RouletteBase {
  // Object to store players and their bets
  bets: { [key: string]: Bet };
  // Last winning number
  winningNumber: number;
  // All betting places
  allNumbers: number[];
  // Casino's edge
  edge: Fraction;

  static getAllNumbers(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  constructor(n: number, edge: Fraction) {
    this.bets = {};
    this.winningNumber = NaN;
    this.edge = edge;
    this.allNumbers = RouletteBase.getAllNumbers(n);
  }

  // Method to accept bets from players
  placeBet(
    playerId: string,
    betAmount: number,
    betNumbers: number[]
  ): void | string {
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
    const winningNumber =
      this.allNumbers[Math.floor(Math.random() * this.allNumbers.length)];
    return (this.winningNumber = winningNumber);
  }

  // Compute the chance of winning (note: may depend on this.winningNumber)
  abstract allNumberChances(): {
    chances: FractionOrInf[];
    multiplier: Fraction;
  };

  private getPlayerWonChance(
    allChances: { chances: FractionOrInf[]; multiplier: Fraction },
    playerId: string
  ): number {
    const playerBet = this.bets[playerId];
    let playerWonChance = new Fraction(0);
    for (const i of playerBet.numbers) {
      if (allChances.chances[i] instanceof Infty) {
        return allChances.multiplier.equals(0) ? 1 : Infinity;
      } else {
        playerWonChance = playerWonChance.add(allChances.chances[i]);
      }
    }
    return allChances.multiplier.mul(playerWonChance).valueOf();
  }

  // Method to compute winnings for each player based on the last winning number
  computeWinnings(
    callback: (
      playerId: string,
      didWin: boolean,
      chance: number,
      amount: number,
      payout: Fraction
    ) => void
  ) {
    // For each number in allNumbers, compute the chance of winning
    const allChances = this.allNumberChances();

    for (const playerId in this.bets) {
      const playerBet = this.bets[playerId];
      const playerWonChance = this.getPlayerWonChance(allChances, playerId);
      let payout = new Fraction(-playerBet.amount);
      const didWin = playerBet.numbers.includes(this.winningNumber);
      const outcomeChance = allChances.chances[this.winningNumber];

      if (didWin && !(outcomeChance instanceof Infty)) {
        payout = payout.add(
          (allChances.multiplier.equals(0)
            ? new Fraction(1) // allow winning when going all-in with 0 points
            : new Fraction(playerBet.amount).div(allChances.multiplier)
          )
            .div(playerBet.numbers.length)
            .mul(new Fraction(1).sub(this.edge))
            .div(outcomeChance)
        );
      }

      callback(playerId, didWin, playerWonChance, playerBet.amount, payout);
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
  allNumberChances(): { chances: FractionOrInf[], multiplier: Fraction } {
    return {
      chances: this.allNumbers.map(() => new Fraction(1)),
      multiplier: new Fraction(this.allNumbers.length).inverse(),
    };
  }
}

// Predictions class
class Prediction extends RouletteBase {
  constructor(n: number) {
    super(n, new Fraction(0));
  }

  // Method to calculate prediction winning chance
  allNumberChances(): { chances: FractionOrInf[], multiplier: Fraction } {
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
      return { chances: bets, multiplier: new Fraction(1) };
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
      return { chances: bets, multiplier: sum.inverse() };
    } else if (bets[this.winningNumber].equals(0)) {
      // now we need to distinguish different 0-chance bets, rescale everything
      let rescale = new Fraction(0);
      for (const playerId in this.bets) {
        if (this.bets[playerId].numbers.includes(this.winningNumber)) {
          rescale = rescale.add(
            new Fraction(this.bets[playerId].numbers.length).inverse()
          );
        }
      }
      let bets = this.allNumbers.map<FractionOrInf>(() => new Fraction(0));
      bets.fill(Infty.value);
      bets[this.winningNumber] = rescale.div(sum);
      return { chances: bets, multiplier: new Fraction(0) };
    } else {
      return { chances: bets, multiplier: sum.inverse() };
    }
  }
}
