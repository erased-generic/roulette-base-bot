export {
  ChatContext,
  BotHandler,
  Bot,
  BotContext,
  splitCommand,
  selectHandler,
  callHandler,
  composeBots,
  GameResult,
  GameContext,
  GameMoveResult,
  Game,
  GameBrain
};

import { UserData } from "./userdata";

interface ChatContext {
  username?: string;
  "user-id": string;
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
  return { handler: bot.handlers[key], key, args };
}

function callHandler(bot: Bot, handler: BotHandler, context: ChatContext, args: string[]): string | undefined {
  bot.onHandlerCalled(context, args);
  return handler.action(context, args)
    ?.replace("%{format}", `${args[0]} ${handler.format}`);
}

function composeBots(bots: Bot[]): Bot {
  const ctx = bots[0].getContext();
  let bot: Bot = {
    handlers: {
      ...bots.reduce((acc, bot) => ({ ...acc, ...bot.handlers }), {}),
      "help": {
        action: (context, args) => {
          if (args.length > 1) {
            const key = args[1];
            if (key in bot.handlers) {
              return `${ctx.cmdMarker}${key}: ${bot.handlers[key].description}. Format: ${ctx.cmdMarker}${key} ${bot.handlers[key].format}`;
            } else {
              return `${ctx.cmdMarker}${key} is not a valid command.`
            }
          }
          return `Available commands: ${Object.keys(bot.handlers).map(x => `${ctx.cmdMarker}${x}`).join(", ")}`;
        },
        description: "List available commands or describe a command",
        format: "[<command name>]"
      }
    },
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
  getCurrentPlayer(): string;

  init(): GameResult | undefined;
  readonly moveHandlers: { [move: string]: (args: string[]) => GameMoveResult };
}

interface GameBrain<T extends Game> {
  requestGame(args: string[]): { args: string[] } | undefined;
  move(game: T): { move: string, args: string[] } | undefined;
}
