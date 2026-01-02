import { Trie } from "./trie";

export {
  HandlerContext,
  ChatContext,
  BotHandler,
  Bot,
  BotContext,
  splitCommand,
  selectHandler,
  visitHandlers,
  callHandler,
  composeBots,
  formatTime,
  GameResult,
  GameContext,
  GameMoveResult,
  Game,
  GameBrain,
  RejectingBrain,
  Schema,
  PredicatedValue,
  predicatedValue,
  noDefaultValue,
  NoDefaultValue,
  optionalValue,
  OptionalValue,
  MappedSchemaElement,
  MappedSchema,
  MappedSchemaFromGet,
  Configurable,
  ConfigurableRegistry,
  ConfigName,
  applySchema,
  combineSchemas,
  isValidBySchema,
};

type Schema = { [key: string]: any };

function isInstance(obj: any, c: abstract new (...args: any[]) => any) {
  return obj instanceof c || obj?.constructor === c;
}

class PredicatedValue<T extends Object> {
  constructor(
    private c: abstract new (...args: any[]) => T,
    private p: (x: T) => boolean
  ) {}

  isValid(x: any) {
    return isInstance(x, this.c) && this.p(x as T);
  }

  combine<RT extends Object>(
    x: PredicatedValue<RT>
  ): PredicatedValue<T & RT> | undefined;
  combine(x: any): PredicatedValue<Object> | undefined;

  combine(x: any) {
    if (x === undefined) {
      return this;
    }
    if (x instanceof PredicatedValue) {
      return predicatedValue(
        Object,
        (y: any) => this.isValid(y) && x.isValid(y)
      );
    }
    return undefined;
  }
}

function predicatedValue<T extends Object>(
  c: abstract new (...args: any[]) => T,
  p: (x: T) => boolean
): PredicatedValue<T> {
  return new PredicatedValue<T>(c, p);
}

class NoDefaultValue<T extends Object> extends PredicatedValue<T> {
  readonly _brand = "NoDefaultValue" as const;
  constructor(
    c: abstract new (...args: any[]) => T,
    p: (x: T) => boolean = (x: any) => true
  ) {
    super(c, p);
  }
}

class OptionalValue<T extends Object> extends PredicatedValue<T> {
  readonly _brand = "Optional" as const;
  constructor(
    c: abstract new (...args: any[]) => T,
    p: (x: T) => boolean = (x: any) => true
  ) {
    super(c, p);
  }

  isValid(x: any) {
    return super.isValid(x) || x === undefined;
  }
}

function noDefaultValue<T extends Object>(
  c: abstract new (...args: any[]) => T,
  p?: (x: T) => boolean
) {
  return new NoDefaultValue<T>(c, p);
}

function optionalValue<T extends Object>(
  c: abstract new (...args: any[]) => T,
  p?: (x: T) => boolean
) {
  return new OptionalValue<T>(c, p);
}

function combineValues<LT extends Object, RT extends Object>(
  lhs: PredicatedValue<LT>,
  rhs: PredicatedValue<RT>
): PredicatedValue<LT & RT> | undefined {
  return lhs.combine(rhs);
}

function combineSchemas<LT extends Schema, RT extends Schema>(
  lhs: LT,
  rhs: RT
): LT & RT {
  let res: Schema = { ...lhs };
  for (const key in rhs) {
    if (!(key in res)) {
      res = { ...res, [key]: rhs[key] };
      continue;
    }
    if (
      !isInstance(rhs[key], PredicatedValue<Object>) ||
      !isInstance(res[key], PredicatedValue<Object>)
    ) {
      if (rhs[key] !== res[key]) {
        throw new Error(`* key ${key} is not compatible`);
      }
      continue;
    }
    const combined = combineValues(res[key], rhs[key]);
    if (combined === undefined) {
      throw new Error(`* key ${key} is not compatible`);
    }
    res[key] = combined;
  }
  return res as LT & RT;
}

type MappedSchemaElement<T> = T extends NoDefaultValue<infer U>
  ? U
  : T extends OptionalValue<infer U>
  ? U | undefined
  : T;

type MappedSchema<T extends Schema> = {
  [key in keyof T]: MappedSchemaElement<T[key]>;
};

type MappedSchemaFromGet<T> = T extends (...args: any[]) => infer U
  ? U extends Schema
    ? MappedSchema<U>
    : never
  : never;

function applySchema<T extends Schema>(c: any, schema: T): MappedSchema<T> {
  return Object.entries({ ...schema, ...c })
    .filter(([key, val]) => !(val instanceof PredicatedValue))
    .reduce(
      (acc, [key, val]) => ({ ...acc, [key]: val }),
      {}
    ) as MappedSchema<T>;
}

function isValidBySchema<T extends Schema>(
  c: any,
  schema: T
): c is MappedSchema<T> {
  for (const key in schema) {
    const defaultVal: any = schema[key];
    if (!(key in c)) {
      if (defaultVal instanceof OptionalValue) {
        continue;
      }
      console.log(`* missing key ${key}`);
      return false;
    }
    const val = c[key];
    if (defaultVal instanceof NoDefaultValue) {
      if (!defaultVal.isValid(val)) {
        console.log(`* invalid nodefault key ${key}`);
        return false;
      }
    } else if (defaultVal instanceof OptionalValue) {
      if (!defaultVal.isValid(val)) {
        console.log(`* invalid optional key ${key}`);
        return false;
      }
    } else if (!isInstance(val, defaultVal.constructor)) {
      console.log(`* invalid key ${key}`);
      return false;
    }
  }
  return true;
}

interface Configurable {}

class ConfigurableRegistry {
  private static registry = new Map<
    string,
    (c: any) => Configurable | undefined
  >();
  public static register(
    name: string,
    ctor: (c: any) => Configurable | undefined
  ) {
    this.registry.set(name, ctor);
  }
  public static get(
    name: string
  ): ((c: any) => Configurable | undefined) | undefined {
    return ConfigurableRegistry.registry.get(name);
  }
}

function ConfigName<ConfigT extends {}>(
  name: string,
  configSchema: () => ConfigT
) {
  return (constructor: new (c: MappedSchema<ConfigT>) => Configurable) => {
    constructor.prototype.name = name;
    ConfigurableRegistry.register(name, (c: any) => {
      const defaultC = configSchema();
      const cWithDefaults = applySchema(c, defaultC);
      if (!isValidBySchema(cWithDefaults, defaultC)) {
        return undefined;
      }
      return new constructor(cWithDefaults);
    });
  };
}

interface ChatContext {
  username?: string;
  "user-id": string;
  "sent-at"?: number;
  mod: boolean;
}

interface HandlerContext extends ChatContext {
  self: Bot;
}

interface BotHandler {
  action: (context: HandlerContext, args: string[]) => string | undefined;
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

  onHandlerCalled(context: HandlerContext, args: string[]): void;
  getContext(): BotContext;
}

function isCommandPrivate(cmd: string) {
  return cmd.startsWith("_");
}

function visitHandlers(
  bot: Bot,
  keys: Iterable<string>,
  skipPredicate: (cmd: string) => boolean,
  visitor: (cmd: string, value: BotHandler) => boolean
) {
  bot.handlersTrie.visit(keys, (path, value) => {
    const cmd = path.join("");
    if (skipPredicate(cmd)) {
      return true;
    }
    return visitor(cmd, value);
  });
}

function visitPublicHandlers(
  bot: Bot,
  keys: Iterable<string>,
  visitor: (cmd: string, value: BotHandler) => boolean
) {
  visitHandlers(bot, keys, isCommandPrivate, visitor);
}

function splitCommand(command: string) {
  return command.split(/\s+/);
}

function selectHandler(
  bot: Bot,
  command: string
): { handler?: BotHandler; key: string; args: string[] } | undefined {
  if (!command.startsWith(bot.getContext().cmdMarker)) {
    return undefined;
  }
  const args = splitCommand(command);
  const key = args[0].substring(bot.getContext().cmdMarker.length);
  const handlers: [string, BotHandler][] = [];
  visitPublicHandlers(bot, key, (cmd, value) => {
    handlers.push([cmd, value]);
    return cmd !== key;
  });
  if (handlers.length !== 1) {
    return { key, args };
  }
  return { handler: handlers[0][1], key: handlers[0][0], args };
}

function callHandler(
  bot: Bot,
  handler: BotHandler,
  context: ChatContext,
  args: string[]
): string | undefined {
  const handlerCtx = { ...context, self: bot };
  bot.onHandlerCalled(handlerCtx, args);
  return handler
    .action(handlerCtx, args)
    ?.replace("%{format}", `${args[0]} ${handler.format}`);
}

function composeBots(bots: Bot[]): Bot {
  const ctx = bots[0].getContext();
  const handlers = {
    ...bots.reduce((acc, bot) => ({ ...acc, ...bot.handlers }), {}),
    help: {
      action: (context: HandlerContext, args: string[]) => {
        const handlers: [string, BotHandler][] = [];
        const key = args.length > 1 ? args[1] : "";
        let exactMatch = false;
        let cmds = ""; // list commands when multiple matches are found
        let desc: string | undefined = undefined; // describe the command, if there's an exact match or only one match
        visitPublicHandlers(bot, key, (cmd, handler) => {
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
  readonly moveHandlers: {
    [move: string]: (userId: string, args: string[]) => GameMoveResult;
  };
}

abstract class GameBrain<T extends Game> {
  abstract requestGame(
    userId: string,
    username: string,
    args: string[]
  ): { args: string[] } | string;
  abstract move(
    game: T
  ): { move?: string & keyof T["moveHandlers"]; args: string[] } | undefined;
}

class RejectingBrain<T extends Game> extends GameBrain<T> {
  chance: number;

  constructor(chance: number) {
    super();
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
    const intervalId = (Date.now() / RejectingBrain.UPDATE_INTERVAL_MS).toFixed(
      0
    );
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

  move(
    game: T
  ): { move?: string & keyof T["moveHandlers"]; args: string[] } | undefined {
    return undefined;
  }
}
