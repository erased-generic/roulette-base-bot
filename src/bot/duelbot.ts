export { DuelCommand, DuelAccepted, DuelBot };

import * as rouletteModule from "../util/roulette";
import { UserData } from "../util/userdata";
import {
  ChatContext,
  Game,
  GameBrain,
  GameContext,
  GameResult,
} from "../util/interfaces";
import { BotBase, BotBaseContext, PerUserData } from "./botbase";

class DuelInfo {
  lastResult?: GameResult;

  constructor(lastResult: GameResult | undefined) {
    this.lastResult = lastResult;
  }
}

class DuelRendezvous extends DuelInfo {
  userId1: string;
  username2: string;
  amount: number;
  args: string[];

  constructor(
    leftover: DuelInfo | undefined,
    userId1: string,
    username2: string,
    amount: number,
    args: string[]
  ) {
    super(leftover?.lastResult);
    this.userId1 = userId1;
    this.username2 = username2;
    this.amount = amount;
    this.args = args;
  }
}

class DuelAccepted<T extends Game> extends DuelRendezvous {
  userId2: string;
  prediction: rouletteModule.Prediction;
  payload: T;

  constructor(
    rendezvous: DuelRendezvous,
    userId2: string,
    prediction: rouletteModule.Prediction,
    payload: T
  ) {
    super(
      rendezvous as DuelInfo,
      rendezvous.userId1,
      rendezvous.username2,
      rendezvous.amount,
      rendezvous.args
    );
    this.userId2 = userId2;
    this.prediction = prediction;
    this.payload = payload;
  }
}

function formatUsername(input: string) {
  if (input.startsWith("@")) {
    input = input.substring(1);
  }
  return input.toLowerCase();
}

interface DuelCommand {
  amount: number;
  username: string;
}

abstract class DuelBot<T extends Game> extends BotBase {
  readonly duels: { [key: string]: DuelInfo } = {};
  readonly playerShuffleChance: number;
  readonly duelDescription: string;
  readonly gameBrain: GameBrain<T>;

  constructor(
    botContext: BotBaseContext,
    playerShuffleChance: number = 0.5,
    duelDescription: string,
    gameBrain?: GameBrain<T>
  ) {
    super(botContext);
    this.playerShuffleChance = playerShuffleChance;
    this.duelDescription = duelDescription;
    this.gameBrain = gameBrain;
  }

  onHandlerCalled(context: ChatContext, args: string[]): void {}

  static parseDuelCommand(args: string[]): DuelCommand | string {
    if (args.length < 3) {
      return "too few arguments";
    }
    if (args.length > 3) {
      return "too many arguments";
    }
    const amount = BotBase.parseAmount(args[1]);
    if (typeof amount === "string") {
      return amount;
    }
    return { amount, username: formatUsername(args[2]) };
  }

  duelHandler(context: ChatContext, args: string[]): string | undefined {
    const username = context["username"];
    const duelCommand = DuelBot.parseDuelCommand(args);
    if (typeof duelCommand === "string") {
      return `Parse error: ${duelCommand}, try %{format}, ${username}!`;
    }
    const userId1 = context["user-id"];
    let oldInfo = this.duels[userId1];
    if (oldInfo instanceof DuelAccepted) {
      return `Duel already in progress, ${username}!`;
    }
    let extraReserveLimit: number = 0;
    if (oldInfo instanceof DuelRendezvous) {
      // reclaim old request's points when making the request
      extraReserveLimit = oldInfo.amount;
    }
    const amount = this.ensureBalance(
      userId1,
      duelCommand.amount,
      extraReserveLimit
    );
    if (typeof amount === "string") {
      return amount;
    }

    const username2 = duelCommand.username;
    const rendezvous = new DuelRendezvous(
      oldInfo,
      userId1,
      username2,
      amount,
      args
    );
    console.log(
      `* rendezvous ${this.duelDescription}: ${userId1} ${this.getUsername(
        userId1
      )}, ${username2}, ${amount}`
    );
    if (username2 === this.botContext.botUsername) {
      if (this.gameBrain === undefined) {
        return `Sorry, ${username}, I don't know how to play.`;
      }
      if (this.botContext.botUsername in this.duels) {
        const duel = this.duels[this.botContext.botUsername];
        if (duel instanceof DuelAccepted) {
          const otherUsername =
            duel.username2 === this.botContext.botUsername
              ? this.getUsername(duel.userId1)
              : duel.username2;
          return `${username}, I'm already playing with ${otherUsername}...`;
        }
      }
      const botResponse = this.gameBrain.requestGame(args);
      if (botResponse === undefined) {
        // bot rejects
        return `${username}, I don't want to play with you.`;
      } else {
        // bot accepts
        // NOTE: currently bot only has `DuelAccepted` instances in `this.duels`
        // NOTE: if bot could send the requests itself, we would need to reclaim bot's points
        return (
          "I accept! " +
          this.startDuel(
            rendezvous,
            rendezvous.amount,
            username2,
            botResponse.args
          )
        );
      }
    }
    this.duels[userId1] = rendezvous;
    return `${username2}, reply with ${this.botContext.cmdMarker}accept [${username}] to accept the ${this.duelDescription}, if you're ready to bet ${amount} points!`;
  }

  private unrendezvous(duel: DuelRendezvous) {
    console.log(
      `* unrendezvous ${this.duelDescription}: ${
        duel.userId1
      } ${this.getUsername(duel.userId1)}, ${duel.username2}, ${duel.amount}`
    );
    this.reserveBalance(duel.userId1, -duel.amount);
    delete this.duels[duel.userId1];
  }

  private matchDuelResult(
    result: GameResult,
    win: (winnerId: string, loserId: string) => void,
    tie: (player1: string, player2: string) => void
  ) {
    if (result.ranking.length === 1) {
      tie(result.ranking[0][0], result.ranking[0][1]);
    } else {
      const winnerId = result.ranking[0][0];
      const loserId = result.ranking[1][0];
      win(winnerId, loserId);
    }
  }

  private processDuelResult(duel: DuelAccepted<T>, result: GameResult) {
    this.duels[duel.userId2] = this.duels[duel.userId1] = new DuelInfo(result);

    let msg = ``;
    this.matchDuelResult(
      result,
      (winnerId: string, loserId: string) => {
        msg += `The winner is ${this.getUsername(result.ranking[0][0])}`;
        const callback = this.createWinningsCallback(
          (
            username: string | undefined,
            didWin: boolean,
            delta: number,
            chance: number,
            balance: number
          ) => {
            if (username === this.botContext.botUsername) {
              // Bot's balance isn't final until all the callbacks are called, just don't print anything
              return "";
            }
            if (didWin) {
              return `${username} won ${delta} points and now has ${balance} points`;
            } else {
              return `${username} lost ${-delta} points and now has ${balance} points`;
            }
          }
        );
        duel.prediction.lastNumber = winnerId === duel.userId1 ? 0 : 1;
        duel.prediction.computeWinnings(
          (
            playerId: string,
            didWin: boolean,
            chance: number,
            amount: number,
            payout: number
          ) => {
            console.log(
              `* ${this.duelDescription}: ${playerId}, ${this.getUsername(
                playerId
              )}, ${amount}, ${payout}`
            );
            msg = BotBase.appendMsg(
              msg,
              callback(playerId, didWin, chance, amount, payout),
              ";\n"
            );
          }
        );
        console.log(
          `* won: ${winnerId} ${this.getUsername(
            winnerId
          )} against ${loserId} ${this.getUsername(loserId)}`
        );
      },
      () => {
        msg += `It's a tie! All points return to their respective owners.`;
        this.unbetAll(duel.prediction);
        console.log(
          `* tie ${this.duelDescription}: ${
            result.ranking[0][0]
          } ${this.getUsername(result.ranking[0][0])} vs ` +
            `${result.ranking[0][1]} ${this.getUsername(result.ranking[0][1])}`
        );
      }
    );
    return msg;
  }

  private resign(duel: DuelAccepted<T>, userId: string): string {
    let ranking = [[duel.userId1], [duel.userId2]];
    if (userId === duel.userId1) {
      ranking.reverse();
    }
    const username = this.getUsername(userId);
    console.log(`* forfeit ${this.duelDescription}: ${userId}, ${username}`);
    return (
      `${username} forfeits the ${this.duelDescription}. ` +
      this.processDuelResult(duel, { ranking })
    );
  }

  unduelHandler(context: ChatContext, args: string[]): string | undefined {
    const userId = context["user-id"];
    const duel = this.duels[userId];
    if (duel instanceof DuelAccepted) {
      return this.resign(duel, userId);
    } else if (duel instanceof DuelRendezvous) {
      this.unrendezvous(duel);
    }
    return `${context["username"]} retracted all their ${this.duelDescription} requests`;
  }

  protected abstract printDuelIntro(
    duel: DuelAccepted<T>
  ): string;
  protected abstract printDuelStatus(
    duel: DuelAccepted<T>,
    moreInfo: boolean
  ): string;
  protected abstract printDuelPrompt(
    duel: DuelAccepted<T>,
    moreInfo: boolean
  ): string;
  protected abstract printDuelResult(
    duel: DuelAccepted<T>,
    moreInfo: boolean,
    result: GameResult
  ): string;

  protected getGameContext(): GameContext {
    return {
      getUsername: this.getUsername.bind(this),
    };
  }

  private printDuel(
    duel: DuelAccepted<T>,
    moreInfo: boolean,
    result?: GameResult
  ): string {
    let msg = this.printDuelStatus(duel, moreInfo);

    if (result !== undefined) {
      return BotBase.appendMsg(
        msg,
        BotBase.appendMsg(
          this.printDuelResult(duel, moreInfo, result),
          this.processDuelResult(duel, result)
        ),
        "\n"
      );
    }

    if (
      !(
        this.gameBrain !== undefined &&
        duel.payload.getCurrentPlayer() === this.botContext.botUsername
      )
    ) {
      msg = BotBase.appendMsg(msg, this.printDuelPrompt(duel, moreInfo), "\n");
      return msg;
    }

    // ask the bot to make a move
    const move = this.gameBrain.move(duel.payload);
    if (move === undefined) {
      // resign
      msg = BotBase.appendMsg(
        msg,
        this.resign(duel, this.botContext.botUsername),
        "\n"
      );
    } else {
      // make a move
      const newResult = duel.payload.moveHandlers[move.move](move.args);
      msg = BotBase.appendMsg(
        msg,
        newResult.describe(this.getGameContext()),
        "\n"
      );
      msg = BotBase.appendMsg(
        msg,
        this.printDuel(duel, false, newResult.result),
        "\n"
      );
    }
    return msg;
  }

  checkHandler(context: ChatContext, args: string[]): string | undefined {
    const userId = context["user-id"];
    const duel = this.duels[userId];
    if (duel instanceof DuelAccepted) {
      return this.printDuel(duel, true);
    } else if (duel?.lastResult !== undefined) {
      let msg = `${context["username"]}, your last ${this.duelDescription} result was: `;
      this.matchDuelResult(
        duel.lastResult,
        (winnerId: string, loserId: string) => {
          if (userId === winnerId) {
            msg += `you won against ${this.getUsername(loserId)}`;
          } else {
            msg += `you lost to ${this.getUsername(winnerId)}`;
          }
        },
        (player1: string, player2: string) => {
          msg += `you tied with ${this.getUsername(
            player1 === userId ? player2 : player1
          )}`;
        }
      );
      return msg;
    }
    return `${context["username"]}, you're not in a ${this.duelDescription}!`;
  }

  protected abstract createDuelPayload(
    players: string[],
    argsReq: string[],
    argsResp: string[]
  ): T;

  private startDuel(
    rendezvous: DuelRendezvous,
    amount2: number,
    userId2: string,
    args: string[]
  ): string {
    let msg = "";
    this.reserveBalance(userId2, amount2);
    const prediction = new rouletteModule.Prediction(2);
    if (rendezvous.userId1 === userId2) {
      // hack for testing, just add the bets
      prediction.placeBet(userId2, rendezvous.amount + amount2, [0, 1]);
    } else {
      // userUd1 -> 0, userId2 -> 1
      prediction.placeBet(rendezvous.userId1, rendezvous.amount, [0]);
      prediction.placeBet(userId2, amount2, [1]);
    }

    const players = [rendezvous.userId1, userId2];
    // randomize who goes first
    if (Math.random() < this.playerShuffleChance) {
      players.reverse();
    }
    const accepted = new DuelAccepted(
      rendezvous,
      userId2,
      prediction,
      this.createDuelPayload(players, rendezvous.args, args)
    );

    // this.duels[rendezvous.userId1] is the rendezvous, no need to reclaim points
    this.duels[rendezvous.userId1] = accepted;
    // this.duels[userId2] was checked in the precondition or cleared during the search
    // => no need to reclaim points
    this.duels[userId2] = accepted;
    console.log(
      `* duel ${this.duelDescription}: ${accepted.userId1} ${this.getUsername(
        accepted.userId1
      )} with ${accepted.amount} vs ` +
        `${userId2} ${rendezvous.username2} with ${amount2}`
    );

    msg +=
      `Let the ${this.duelDescription} begin, ${this.getUsername(
        players[0]
      )} is first to play!`;
    msg = BotBase.appendMsg(msg, this.printDuelIntro(accepted), "\n");
    msg = BotBase.appendMsg(msg, this.printDuel(accepted, true, accepted.payload.init()), "\n");
    return msg;
  }

  private prepareRendezvous(
    username1: string | undefined,
    userId2: string
  ): DuelRendezvous | string {
    const username2 = this.getUsername(userId2);

    if (userId2 in this.duels) {
      const duel = this.duels[userId2];
      if (duel instanceof DuelAccepted) {
        const otherUsername =
          duel.username2 === username2
            ? this.getUsername(duel.userId1)
            : duel.username2;
        return `${username2}, you already have a ${this.duelDescription} in progress with ${otherUsername}!`;
      }
    }

    // Find our rendezvous
    let rendezvous: DuelRendezvous | undefined;
    for (const duel of Object.values(this.duels)) {
      if (duel instanceof DuelRendezvous) {
        const duelUsername1 = this.getUsername(duel.userId1);
        if (
          !(duel instanceof DuelAccepted) &&
          (username1 === undefined || duelUsername1 === username1) &&
          duel.username2 === username2
        ) {
          // found!
          if (rendezvous !== undefined) {
            // ambiguous
            return `${username2}, please specify your opponent!`;
          }
          rendezvous = duel;
        } else if (duel.userId1 === userId2) {
          // cancel our request and reclaim the points
          this.unrendezvous(duel);
        }
      }
    }
    if (rendezvous === undefined) {
      // didn't find.
      if (username1 === undefined) {
        // no username, just say that no request exists
        return `${username2}, no one requested a ${this.duelDescription} with you!`;
      }
      // maybe the target is duelling someone else
      if (this.duels[username1] instanceof DuelAccepted) {
        return `${username2}, ${username1} is busy!`;
      }
      // nope, no request at all
      return `${username2}, ${username1} didn't request a ${this.duelDescription} with you!`;
    }

    return rendezvous;
  }

  acceptHandler(context: ChatContext, args: string[]): string | undefined {
    const userId2 = context["user-id"];
    const username2 = context["username"];

    const rendezvous = this.prepareRendezvous(
      args.length > 1 ? args[1] : undefined,
      userId2
    );
    if (typeof rendezvous === "string") {
      return rendezvous;
    }

    let msg = "";
    // just go all-in, if we don't have enough points
    const balance2 = this.getBalance(userId2);
    let amount2 = rendezvous.amount;
    if (amount2 >= balance2) {
      amount2 = balance2;
      msg += `${username2} is going all-in with ${amount2} points! `;
    }

    return BotBase.appendMsg(
      msg,
      this.startDuel(rendezvous, amount2, userId2, args)
    );
  }

  moveHandler(
    move: string,
    context: ChatContext,
    args: string[]
  ): string | undefined {
    const userId = context["user-id"];
    const username = context["username"];
    const duel = this.duels[userId];
    if (!(duel instanceof DuelAccepted)) {
      return `${username}, you're not in a duel!`;
    }
    const game: T = duel.payload;
    if (game.getCurrentPlayer() !== userId) {
      return `${username}, it's not your turn!`;
    }
    const handler = game.moveHandlers[move];
    if (handler === undefined) {
      return `${username}, something went wrong...`;
    }
    const result = handler(args);
    const msg = result.describe(this.getGameContext());
    return BotBase.appendMsg(msg, this.printDuel(duel, false, result.result));
  }

  rendezvousHandler(context: ChatContext, args: string[]): string | undefined {
    const userId = context["user-id"];
    const username = context["username"];
    let msg = `${username}, you are participating in: `;
    let metAccepted = false;
    let msgs = [];
    for (const duel of Object.values(this.duels)) {
      if (duel instanceof DuelRendezvous) {
        if (duel.userId1 === userId || duel.username2 === username) {
          if (duel instanceof DuelAccepted) {
            if (!metAccepted) {
              msgs.push(
                `an ongoing ${this.duelDescription} ${this.getUsername(
                  duel.userId1
                )} <-> ${duel.username2}`
              );
              metAccepted = true;
            }
          } else {
            msgs.push(
              `a ${this.duelDescription} request ${this.getUsername(
                duel.userId1
              )} -> ${duel.username2}`
            );
          }
        }
      }
    }
    if (msgs.length === 0) {
      msg += `no ${this.duelDescription}s or requests.`;
    } else {
      msg += msgs.join(";\n");
    }
    return msg;
  }
}
