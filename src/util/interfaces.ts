import { Trie } from "./trie";

export {
  ChatContext,
  BotHandler,
  Bot,
  BotContext,
  splitCommand,
  selectHandler,
  callHandler,
  composeBots,
  formatTime,
  GameResult,
  GameContext,
  GameMoveResult,
  Game,
  GameBrain,
  RejectingBrain
};

interface ChatContext {
  username?: string;
  "user-id": string;
  "sent-at"?: number;
  mod: boolean;
}

interface BotHandler {
  action: (context: ChatContext, args: string[]) => string | undefined;
  description: string;
  format: string;
}

interface BotContext {
  cmdMarker: string;
  botUsername: string;
}

interface Bot {
  readonly handlers: { [key: string]: BotHandler };
  handlersTrie: Trie<string, BotHandler>;

  onHandlerCalled(context: ChatContext, args: string[]): void;
  getContext(): BotContext;
}

function splitCommand(command: string) {
  return command.split(/\s+/);
}

function selectHandler(bot: Bot, command: string): { handler?: BotHandler, key: string, args: string[] } | undefined {
  if (!command.startsWith(bot.getContext().cmdMarker)) {
    return undefined;
  }
  const args = splitCommand(command);
  const key = args[0].substring(bot.getContext().cmdMarker.length);
  const handlers: [string, BotHandler][] = [];
  bot.handlersTrie.visit(key, (path, value) => {
    const cmd = path.join("");
    handlers.push([path.join(""), value]);
    return cmd !== key;  // Stop at exact match
  });
  if (handlers.length !== 1) {
    return { key, args };
  }
  return { handler: handlers[0][1], key: handlers[0][0], args };
}

function callHandler(bot: Bot, handler: BotHandler, context: ChatContext, args: string[]): string | undefined {
  bot.onHandlerCalled(context, args);
  return handler.action(context, args)
    ?.replace("%{format}", `${args[0]} ${handler.format}`);
}

function composeBots(bots: Bot[]): Bot {
  const ctx = bots[0].getContext();
  const handlers = {
    ...bots.reduce((acc, bot) => ({ ...acc, ...bot.handlers }), {}),
    help: {
      action: (context: ChatContext, args: string[]) => {
        const handlers: [string, BotHandler][] = [];
        const key = args.length > 1 ? args[1] : "";
        let exactMatch = false;
        let cmds = ""; // list commands when multiple matches are found
        let desc: string | undefined = undefined; // describe the command, if there's an exact match or only one match
        bot.handlersTrie.visit(key, (path, handler) => {
          const cmd = path.join("");
          if (cmd === key) {
            exactMatch = true;
          }
          handlers.push([cmd, handler]);
          if (desc === undefined) {
            // fill in first match
            desc = `${ctx.cmdMarker}${cmd}: ${handler.description}. Format: ${ctx.cmdMarker}${cmd} ${handler.format}`;
          } else if (!exactMatch) {
            // no exact match and more than one match => skip description
            desc = "";
          }
          return true;
        });

        if (handlers.length === 0) {
          return `${ctx.cmdMarker}${key} is not a valid command.`;
        } else if (handlers.length > 1) {
          // more than one match => list commands
          cmds = `Available commands: ${handlers
            .map((x) => `${ctx.cmdMarker}${x[0]}`)
            .join(", ")}${desc ? ".\n" : ""}`;
        }
        return cmds + desc;
      },
      description: "List available commands or describe a command",
      format: "[<command name>]",
    },
  };
  let bot: Bot = {
    handlers,
    handlersTrie: new Trie<string, BotHandler>(Object.entries(handlers)),
    onHandlerCalled(context, args) {
      for (const bot of bots) {
        bot.onHandlerCalled(context, args);
      }
    },
    getContext() {
      return bots[0].getContext();
    },
  };

  return bot;
}

function formatTime(timeMs: number) {
  const MINUTE_MS = 1000 * 60;
  const HOUR_MS = MINUTE_MS * 60;

  if (timeMs < MINUTE_MS * 1.5) {
    return `a minute`;
  } else if (timeMs < HOUR_MS) {
    return `${Math.round(timeMs / MINUTE_MS)} minutes`;
  } else {
    return `${Math.round(timeMs / HOUR_MS)} hours`;
  }
}

interface GameResult {
  ranking: string[][];
}

interface GameContext {
  getUsername(playerId: string): string | undefined;
}

interface GameMoveResult {
  result: GameResult | undefined;
  describe(context: GameContext): string;
}

interface Game {
  getPlayers(): string[];
  isCurrentPlayer(userId: string): boolean;

  init(): GameResult | undefined;
  readonly moveHandlers: { [move: string]: (userId: string, args: string[]) => GameMoveResult };
}

interface GameBrain<T extends Game> {
  requestGame(userId: string, username: string, args: string[]): { args: string[] } | string;
  move(game: T): { move: string, args: string[] } | undefined;
}


class RejectingBrain<T extends Game> implements GameBrain<T> {
  chance: number;

  constructor(chance: number) {
    this.chance = chance;
  }

  static hashCode(s: string) {
    return (
      s.split("").reduce(function (a, b) {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
      }, 0) >>> 0
    );
  }

  static readonly UPDATE_INTERVAL_MS = 1000 * 60 * 10;

  requestGame(
    userId: string,
    username: string,
    args: string[]
  ): { args: string[] } | string {
    const intervalId = (
      Date.now() /
      RejectingBrain.UPDATE_INTERVAL_MS
    ).toFixed(0);
    const hash = RejectingBrain.hashCode(username + "@" + intervalId);
    console.log(
      `* requestGame: ${username} ${intervalId} ${hash} ${this.chance}`
    );
    if (hash % 100 < this.chance * 100) {
      return `I'm kind of busy right now, maybe another time... Like in ${formatTime(
        RejectingBrain.UPDATE_INTERVAL_MS
      )}?`;
    }
    return { args: [] };
  }

  move(game: T): { move: string, args: string[] } | undefined {
    return undefined;
  }
}
