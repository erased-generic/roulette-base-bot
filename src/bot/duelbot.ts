export { DuelCommand, DuelAccepted, DuelImpl, DuelMove, DuelHandler, DuelBot };

import * as rouletteModule from "../util/roulette";
import {
  BotHandler,
  HandlerContext,
  MappedSchemaFromGet,
  ConfigName,
  Configurable,
  Game,
  GameBrain,
  GameContext,
  GameResult,
  defaultValue,
} from "../util/interfaces";
import { baseBotConfig, BotBase } from "./botbase";
import Fraction from "fraction.js";

class DuelInfo {
  duelName: string;
  lastResult?: GameResult;

  constructor(duelName: string, lastResult: GameResult | undefined) {
    this.duelName = duelName;
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
    duelName: string,
    userId1: string,
    username2: string,
    amount: number,
    args: string[]
  ) {
    super(duelName, leftover?.lastResult);
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
      rendezvous.duelName,
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
  duelName: string;
}

interface DuelMove {
  description: string;
  format: string;
}

interface DuelHandler {
  action: (
    bot: DuelBot,
    context: HandlerContext,
    args: string[]
  ) => string | undefined;
  description: string;
  format: string;
}

abstract class DuelImpl<T extends Game> implements Configurable {
  abstract handlers: { [key: string]: DuelHandler };
  abstract bindMoves: { [key in keyof T["moveHandlers"]]: DuelMove };
  abstract duelDescription: string;
  abstract gameBrain?: GameBrain<T>;

  abstract printDuelIntro(
    bot: DuelBot,
    context: HandlerContext,
    duel: DuelAccepted<T>
  ): string;
  abstract printDuelStatus(
    bot: DuelBot,
    context: HandlerContext,
    duel: DuelAccepted<T>,
    moreInfo: boolean
  ): string;
  abstract printDuelPrompt(
    bot: DuelBot,
    context: HandlerContext,
    duel: DuelAccepted<T>,
    moreInfo: boolean
  ): string;
  abstract printDuelResult(
    bot: DuelBot,
    context: HandlerContext,
    duel: DuelAccepted<T>,
    moreInfo: boolean,
    result: GameResult
  ): string;

  protected listMoves(bot: DuelBot): string {
    const listMove = (move: [string, DuelMove]) =>
      `${bot.botContext.cmdMarker}${move[0]} ${move[1].format}`;
    const moves = Object.entries(this.bindMoves);

    if (moves.length === 0) {
      return "";
    } else if (moves.length === 1) {
      return `Type ${listMove(moves[0])} to play!`;
    }
    const last = moves[moves.length - 1];
    return `Type ${moves
      .slice(0, moves.length - 1)
      .map(listMove)
      .join(", ")} or ${listMove(last)} to play!`;
  }

  abstract createDuelPayload(
    bot: DuelBot,
    players: string[],
    argsReq: string[],
    argsResp: string[]
  ): T;
}

function duelBotConfig() {
  return baseBotConfig({
    playerShuffleChance: defaultValue(0.5),
    duelImpls: defaultValue({} as { [key: string]: DuelImpl<any> }),
  });
}

@ConfigName("DuelBot", duelBotConfig)
class DuelBot extends BotBase implements Configurable {
  readonly duels: { [key: string]: DuelInfo } = {};
  readonly playerShuffleChance: number;
  readonly duelImpls: { [key: string]: DuelImpl<any> };
  readonly handlers: { [key: string]: BotHandler };

  constructor(config: MappedSchemaFromGet<typeof duelBotConfig>) {
    super(config);
    this.playerShuffleChance = config.playerShuffleChance;
    this.duelImpls = config.duelImpls;
    this.handlers = {
      duels: {
        action: this.duelsHandler.bind(this),
        description: "Duel interface. List all possible duel types",
        format: "",
      },
      duel: {
        action: this.duelHandler.bind(this),
        description:
          "Duel interface. Request a duel with another user (they still need to accept it). " +
          "Multiple concurrent duels are supported",
        format: `<amount of points> <opponent username> [<duel name> = ${
          Object.keys(this.duelImpls)[0]
        }]`,
      },
      acceptDuel: {
        action: this.acceptHandler.bind(this),
        description:
          "Duel interface. Accept a duel request from another user. If you don't have enough points, you go all-in",
        format: `<opponent username>`,
      },
      unduel: {
        action: this.unduelHandler.bind(this),
        description:
          "Duel interface. Retract all your dueling requests and forfeit any ongoing duels",
        format: "",
      },
      rendezvous: {
        action: this.rendezvousHandler.bind(this),
        description: "Duel interface. View all ongoing duels and duel requests",
        format: "",
      },
      checkDuels: {
        action: this.checkHandler.bind(this),
        description: "Duel interface. View your current duel status",
        format: "",
      },
      ...Object.entries(this.duelImpls).reduce(
        (acc, duel) => ({
          ...acc,
          ...Object.entries(duel[1].handlers).reduce(
            (acc, [key, handler]) => ({
              ...acc,
              [key]: {
                action: (context: HandlerContext, args: string[]) => {
                  return handler.action(this, context, args);
                },
                description: `${duel[1].duelDescription} interface. ${handler.description}`,
                format: handler.format,
              },
            }),
            {}
          ),
          ...Object.entries(duel[1].bindMoves).reduce(
            (acc, move) => ({
              ...acc,
              [move[0]]: {
                action: this.moveHandler.bind(this, duel[0], move[0]),
                description: `${duel[1].duelDescription} interface. ${move[1].description}`,
                format: move[1].format,
              },
            }),
            {}
          ),
        }),
        {}
      ),
    };
  }

  static parseDuelCommand(
    args: string[],
    duelNames: string[]
  ): DuelCommand | string {
    if (args.length < 3) {
      return "too few arguments";
    }
    if (args.length > 4) {
      return "too many arguments";
    }
    const amount = BotBase.parseAmount(args[1]);
    if (typeof amount === "string") {
      return amount;
    }
    const username = formatUsername(args[2]);
    let duelName = duelNames[0];
    if (args.length > 3) {
      duelName = args[3];
    }
    if (duelNames.indexOf(duelName) === -1) {
      return `${duelName} is not a valid duel`;
    }
    return { amount, username, duelName };
  }

  duelsHandler(context: HandlerContext, args: string[]): string | undefined {
    return `List of duel types: ${Object.keys(this.duelImpls).join(", ")}`;
  }

  duelHandler(context: HandlerContext, args: string[]): string | undefined {
    const username = context["username"]!;
    const duelCommand = DuelBot.parseDuelCommand(
      args,
      Object.keys(this.duelImpls)
    );
    if (typeof duelCommand === "string") {
      return `Parse error: ${duelCommand}, try %{format}, ${this.addressUser(
        context
      )}!`;
    }
    const duelImpl = this.duelImpls[duelCommand.duelName];
    const userId1 = context["user-id"];
    let oldInfo = this.duels[userId1];
    if (oldInfo instanceof DuelAccepted) {
      return `Duel already in progress, ${this.addressUser(context)}!`;
    }
    let extraReserveLimit: number = 0;
    if (oldInfo instanceof DuelRendezvous) {
      // reclaim old request's points when making the request
      extraReserveLimit = oldInfo.amount;
    }
    const amount = this.ensureBalance(
      context,
      userId1,
      duelCommand.amount,
      extraReserveLimit
    );
    if (typeof amount === "string") {
      return this.ensureBalanceErrorToString(context, userId1, amount);
    }

    const username2 = duelCommand.username;
    const rendezvous = new DuelRendezvous(
      oldInfo,
      duelCommand.duelName,
      // TODO: maybe store duelImpl here as well?
      userId1,
      username2,
      amount,
      args
    );
    console.log(
      `* rendezvous ${duelImpl.duelDescription}: ${userId1} ${this.getUsername(
        context,
        userId1
      )}, ${username2}, ${amount}`
    );
    if (username2 === this.botContext.botUsername) {
      if (duelImpl.gameBrain === undefined) {
        this.unrendezvous(context, rendezvous);
        return `Sorry, ${this.addressUser(context)}, I don't know how to play.`;
      }
      if (this.botContext.botUsername in this.duels) {
        const duel = this.duels[this.botContext.botUsername];
        if (duel instanceof DuelAccepted) {
          const otherUserId =
            duel.userId2 === this.botContext.botUsername
              ? duel.userId1
              : duel.userId2;
          this.unrendezvous(context, rendezvous);
          return `${this.addressUser(
            context
          )}, I'm already playing with ${this.addressUser(
            context,
            otherUserId
          )}...`;
        }
      }
      const botResponse = duelImpl.gameBrain.requestGame(
        userId1,
        username,
        args
      );
      if (typeof botResponse === "string") {
        // bot rejects
        this.unrendezvous(context, rendezvous);
        return `${username}, ${botResponse}`;
      } else {
        // bot accepts
        // NOTE: currently bot only has `DuelAccepted` instances in `this.duels`
        // NOTE: if bot could send the requests itself, we would need to reclaim bot's points
        return (
          "I accept! " +
          this.startDuel(
            context,
            rendezvous,
            rendezvous.amount,
            username2,
            botResponse.args
          )
        );
      }
    }
    this.duels[userId1] = rendezvous;
    return (
      `${username2}, reply with ${this.botContext.cmdMarker}accept [${username}] to accept the ${duelImpl.duelDescription}, ` +
      `if you're ready to bet ${amount} points!`
    );
  }

  private unrendezvous(context: HandlerContext, duel: DuelRendezvous) {
    console.log(
      `* unrendezvous ${this.duelImpls[duel.duelName].duelDescription}: ${
        duel.userId1
      } ${this.getUsername(context, duel.userId1)}, ${duel.username2}, ${
        duel.amount
      }`
    );
    this.reserveBalance(context, duel.userId1, -duel.amount);
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

  private processDuelResult<T extends Game>(
    context: HandlerContext,
    duel: DuelAccepted<T>,
    result: GameResult
  ) {
    this.duels[duel.userId2] = this.duels[duel.userId1] = new DuelInfo(
      duel.duelName,
      result
    );
    const duelImpl = this.duelImpls[duel.duelName] as DuelImpl<T>;

    let msg = ``;
    this.matchDuelResult(
      result,
      (winnerId: string, loserId: string) => {
        msg += `The winner is ${this.addressUser(
          context,
          result.ranking[0][0]
        )}`;
        const callback = this.createWinningsCallback(
          context,
          (
            userId: string,
            didWin: boolean,
            delta: number,
            chance: number,
            balance: number
          ) => {
            if (userId === this.botContext.botUsername) {
              // Bot's balance isn't final until all the callbacks are called, just don't print anything
              return "";
            }
            const username = this.addressUser(context, userId);
            if (didWin) {
              return `${username} won ${delta} points and now has ${balance} points`;
            } else {
              return `${username} lost ${-delta} points and now has ${balance} points`;
            }
          }
        );
        duel.prediction.winningNumber = winnerId === duel.userId1 ? 0 : 1;
        duel.prediction.computeWinnings(
          (
            playerId: string,
            didWin: boolean,
            chance: number,
            amount: number,
            payout: Fraction
          ) => {
            console.log(
              `* ${duelImpl.duelDescription}: ${playerId}, ${this.getUsername(
                context,
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
            context,
            winnerId
          )} against ${loserId} ${this.getUsername(context, loserId)}`
        );
      },
      () => {
        msg += `It's a tie! All points return to their respective owners.`;
        this.unbetAll(context, duel.prediction);
        console.log(
          `* tie ${duelImpl.duelDescription}: ${
            result.ranking[0][0]
          } ${this.getUsername(context, result.ranking[0][0])} vs ` +
            `${result.ranking[0][1]} ${this.getUsername(
              context,
              result.ranking[0][1]
            )}`
        );
      }
    );
    return msg;
  }

  private resign<T extends Game>(
    context: HandlerContext,
    duel: DuelAccepted<T>,
    userId: string
  ): string {
    const duelImpl = this.duelImpls[duel.duelName] as DuelImpl<T>;
    let ranking = [[duel.userId1], [duel.userId2]];
    if (userId === duel.userId1) {
      ranking.reverse();
    }
    console.log(
      `* forfeit ${duelImpl.duelDescription}: ${userId}, ${this.getUsername(
        context,
        userId
      )}`
    );
    return (
      `${this.addressUser(context, userId)} forfeits the ${
        duelImpl.duelDescription
      }. ` + this.processDuelResult(context, duel, { ranking })
    );
  }

  unduelHandler(context: HandlerContext, args: string[]): string | undefined {
    const userId = context["user-id"];
    const duel = this.duels[userId];
    if (duel instanceof DuelAccepted) {
      return this.resign(context, duel, userId);
    } else if (duel instanceof DuelRendezvous) {
      this.unrendezvous(context, duel);
    }
    return `${this.addressUser(context)} retracted all their duel requests`;
  }

  protected getGameContext(context: HandlerContext): GameContext {
    return {
      getUsername: this.addressUser.bind(this, context),
    };
  }

  private printDuel<T extends Game>(
    context: HandlerContext,
    duel: DuelAccepted<T>,
    moreInfo: boolean,
    result?: GameResult
  ): string {
    const duelImpl = this.duelImpls[duel.duelName] as DuelImpl<T>;
    let msg = duelImpl.printDuelStatus(this, context, duel, moreInfo);

    if (result !== undefined) {
      return BotBase.appendMsg(
        msg,
        BotBase.appendMsg(
          duelImpl.printDuelResult(this, context, duel, moreInfo, result),
          this.processDuelResult(context, duel, result)
        ),
        "\n"
      );
    }

    if (
      !(
        duelImpl.gameBrain !== undefined &&
        duel.payload.isCurrentPlayer(this.botContext.botUsername)
      )
    ) {
      msg = BotBase.appendMsg(
        msg,
        duelImpl.printDuelPrompt(this, context, duel, moreInfo),
        "\n"
      );
      return msg;
    }

    // ask the bot to make a move
    const move = duelImpl.gameBrain.move(duel.payload);
    if (move === undefined && duel.payload.isCurrentPlayer(duel.userId1)) {
      // skip move, if the other person can move
      msg = BotBase.appendMsg(
        msg,
        duelImpl.printDuelPrompt(this, context, duel, moreInfo),
        "\n"
      );
      return msg;
    } else if (move === undefined || move.move === undefined) {
      // resign
      msg = BotBase.appendMsg(
        msg,
        this.resign(context, duel, this.botContext.botUsername),
        "\n"
      );
    } else {
      // make a move
      const newResult = duel.payload.moveHandlers[move.move](
        this.botContext.botUsername,
        move.args
      );
      msg = BotBase.appendMsg(
        msg,
        newResult.describe(this.getGameContext(context)),
        "\n"
      );
      msg = BotBase.appendMsg(
        msg,
        this.printDuel(context, duel, false, newResult.result),
        "\n"
      );
    }
    return msg;
  }

  checkHandler(context: HandlerContext, args: string[]): string | undefined {
    const userId = context["user-id"];
    const duel = this.duels[userId];
    if (duel instanceof DuelAccepted) {
      return this.printDuel(context, duel, true);
    } else if (duel?.lastResult !== undefined) {
      const duelImpl = this.duelImpls[duel.duelName];
      let msg = `${this.addressUser(context)}, your last ${
        duelImpl.duelDescription
      } result was: `;
      this.matchDuelResult(
        duel.lastResult,
        (winnerId: string, loserId: string) => {
          if (userId === winnerId) {
            msg += `you won against ${this.addressUser(context, loserId)}`;
          } else {
            msg += `you lost to ${this.addressUser(context, winnerId)}`;
          }
        },
        (player1: string, player2: string) => {
          msg += `you tied with ${this.addressUser(
            context,
            player1 === userId ? player2 : player1
          )}`;
        }
      );
      return msg;
    }
    return `${this.addressUser(context)}, you're not in any duel!`;
  }

  private startDuel(
    context: HandlerContext,
    rendezvous: DuelRendezvous,
    amount2: number,
    userId2: string,
    args: string[]
  ): string {
    const duelImpl = this.duelImpls[rendezvous.duelName];

    let msg = "";
    this.reserveBalance(context, userId2, amount2);
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
      duelImpl.createDuelPayload(this, players, rendezvous.args, args)
    );

    // this.duels[rendezvous.userId1] is the rendezvous, no need to reclaim points
    this.duels[rendezvous.userId1] = accepted;
    // this.duels[userId2] was checked in the precondition or cleared during the search
    // => no need to reclaim points
    this.duels[userId2] = accepted;
    console.log(
      `* duel ${duelImpl.duelDescription}: ${
        accepted.userId1
      } ${this.getUsername(context, accepted.userId1)} with ${
        accepted.amount
      } vs ` + `${userId2} ${rendezvous.username2} with ${amount2}`
    );

    msg += `Let the ${duelImpl.duelDescription} begin!`;
    msg = BotBase.appendMsg(
      msg,
      duelImpl.printDuelIntro(this, context, accepted),
      "\n"
    );
    msg = BotBase.appendMsg(
      msg,
      this.printDuel(context, accepted, true, accepted.payload.init()),
      "\n"
    );
    return msg;
  }

  private prepareRendezvous(
    context: HandlerContext,
    username1: string | undefined,
    userId2: string
  ): DuelRendezvous | string {
    const username2 = this.getUsername(context, userId2);

    if (userId2 in this.duels) {
      const duel = this.duels[userId2];
      if (duel instanceof DuelAccepted) {
        const otherUserId =
          duel.userId2 === userId2 ? duel.userId1 : duel.userId2;
        return `${this.addressUser(context, userId2)}, you already have a ${
          this.duelImpls[duel.duelName].duelDescription
        } in progress with ${this.addressUser(context, otherUserId)}!`;
      }
    }

    // Find our rendezvous
    let rendezvous: DuelRendezvous | undefined;
    for (const duel of Object.values(this.duels)) {
      if (duel instanceof DuelRendezvous) {
        const duelUsername1 = this.getUsername(context, duel.userId1);
        if (
          !(duel instanceof DuelAccepted) &&
          (username1 === undefined || duelUsername1 === username1) &&
          duel.username2 === username2
        ) {
          // found!
          if (rendezvous !== undefined) {
            // ambiguous
            return `${this.addressUser(
              context,
              userId2
            )}, please specify your opponent!`;
          }
          rendezvous = duel;
        } else if (duel.userId1 === userId2) {
          // cancel our request and reclaim the points
          this.unrendezvous(context, duel);
        }
      }
    }
    if (rendezvous === undefined) {
      // didn't find.
      if (username1 === undefined) {
        // no username, just say that no request exists
        return `${this.addressUser(
          context,
          userId2
        )}, no one requested a duel with you!`;
      }
      // maybe the target is duelling someone else
      const duel = this.duels[username1];
      if (duel instanceof DuelAccepted) {
        const userId1 =
          duel.username2 === username1 ? duel.userId2 : duel.userId1;
        return `${this.addressUser(context, userId2)}, ${this.addressUser(
          context,
          userId1
        )} is busy!`;
      }
      // nope, no request at all
      return `${this.addressUser(
        context,
        userId2
      )}, ${username1} didn't request a duel with you!`; // TODO: +addressUser
    }

    return rendezvous;
  }

  acceptHandler(context: HandlerContext, args: string[]): string | undefined {
    const userId2 = context["user-id"];

    const rendezvous = this.prepareRendezvous(
      context,
      args.length > 1 ? args[1] : undefined,
      userId2
    );
    if (typeof rendezvous === "string") {
      return rendezvous;
    }

    let msg = "";
    // just go all-in, if we don't have enough points
    const balance2 = this.getBalance(context, userId2);
    let amount2 = rendezvous.amount;
    if (amount2 >= balance2) {
      amount2 = balance2;
      msg += `${this.addressUser(
        context
      )} is going all-in with ${amount2} points! `;
    }

    return BotBase.appendMsg(
      msg,
      this.startDuel(context, rendezvous, amount2, userId2, args)
    );
  }

  moveHandler(
    duelName: string,
    move: string,
    context: HandlerContext,
    args: string[]
  ): string | undefined {
    const userId = context["user-id"];
    const duel = this.duels[userId];
    if (!(duel instanceof DuelAccepted)) {
      return `${this.addressUser(context)}, you're not in a duel!`;
    }
    if (duel.duelName !== duelName) {
      return `${this.addressUser(context)}, you're not in a ${
        this.duelImpls[duelName].duelDescription
      }!`;
    }
    const game: Game = duel.payload;
    if (!game.isCurrentPlayer(userId)) {
      return `${this.addressUser(context)}, it's not your turn!`;
    }
    const handler = game.moveHandlers[move];
    if (handler === undefined) {
      return `${this.addressUser(context)}, something went wrong...`;
    }
    const result = handler(userId, args);
    const msg = result.describe(this.getGameContext(context));
    return BotBase.appendMsg(
      msg,
      this.printDuel(context, duel, false, result.result)
    );
  }

  rendezvousHandler(
    context: HandlerContext,
    args: string[]
  ): string | undefined {
    const userId = context["user-id"];
    const username = context["username"];
    let msg = `${this.addressUser(context)}, you are participating in: `;
    let metAccepted = false;
    let msgs: string[] = [];
    for (const duel of Object.values(this.duels)) {
      if (duel instanceof DuelRendezvous) {
        const duelImpl = this.duelImpls[duel.duelName];
        if (duel.userId1 === userId || duel.username2 === username) {
          if (duel instanceof DuelAccepted) {
            if (!metAccepted) {
              msgs.push(
                `an ongoing ${duelImpl.duelDescription} ${this.addressUser(
                  context,
                  duel.userId1
                )} <-> ${this.addressUser(context, duel.userId2)}`
              );
              metAccepted = true;
            }
          } else {
            msgs.push(
              `a ${duelImpl.duelDescription} request ${this.addressUser(
                context,
                duel.userId1
              )} -> ${duel.username2}` // TODO: +addressUser
            );
          }
        }
      }
    }
    if (msgs.length === 0) {
      msg += `no duels or requests.`;
    } else {
      msg += msgs.join(";\n");
    }
    return msg;
  }
}
