export { FrameBot, frameBotUserData };

import {
  BotHandler,
  HandlerContext,
  MappedSchemaFromGet,
  ConfigName,
  Configurable,
  noDefaultValue,
  applySchema,
  isValidBySchema,
  listValue,
  schemaValue,
  combineSchemas,
  defaultValue,
  optionalValue,
} from "../util/interfaces";
import {
  baseBotConfigU,
  baseUserData,
  BotBase,
  PredefinedHandler,
} from "./botbase";
import * as fs from "fs";

function frameBotConfig() {
  return baseBotConfigU(
    {
      filePath: noDefaultValue(String),
      overrides: optionalValue(String),
    },
    frameBotUserData()
  );
}

function frameBotUserData() {
  return combineSchemas(baseUserData(), {
    customFrameBegin: defaultValue(""),
    customFrameEnd: defaultValue(""),
    customFramePrice: defaultValue(0),
  });
}

function frameInfoSchema() {
  return {
    begin: noDefaultValue(String),
    end: noDefaultValue(String),
    price: noDefaultValue(Number),
  };
}

type FrameInfo = MappedSchemaFromGet<typeof frameInfoSchema>;

@ConfigName("FrameBot", frameBotConfig)
class FrameBot
  extends BotBase<ReturnType<typeof frameBotUserData>>
  implements Configurable
{
  frames: FrameInfo[];

  readonly handlers: { [key: string]: BotHandler } = {
    frames: {
      action: this.framesHandler.bind(this),
      description: `List all available frames for custom user addressing.`,
      format: "",
    },
    buyFrame: {
      action: this.buyFrameHandler.bind(this),
      description: `Buy a frame for custom user addressing (index -1 means reset to no frame).`,
      format: `<frame index>`,
    },
    ...Object.fromEntries([
      BotBase.toHandler(
        PredefinedHandler.AddressUser,
        this.addressUserImpl.bind(this)
      ),
    ]),
  };

  constructor(config: MappedSchemaFromGet<typeof frameBotConfig>) {
    super(config);
    this.frames = (() => {
      let unparsed: string = "";
      if (config.overrides) {
        unparsed = config.overrides.valueOf();
      } else {
        try {
          unparsed = fs.readFileSync(config.filePath.valueOf(), "utf-8");
        } catch (e) {
          if (e.code === "ENOENT") {
            return [];
          }
          throw e;
        }
      }
      const parsed = JSON.parse(unparsed);

      const schema = { frames: listValue(schemaValue(frameInfoSchema())) };
      const withSchema = applySchema(parsed, schema);
      if (isValidBySchema(withSchema, schema)) {
        return withSchema.frames;
      } else {
        console.log(`* invalid frames: ${JSON.stringify(parsed)}`);
        return [];
      }
    })();
  }

  framesHandler(context: HandlerContext, args: string[]): string | undefined {
    return (
      "Here are some frames you can buy (prices in points per each print - it's a subscription): " +
      this.frames
        .map(
          (frame, i) =>
            `${i}: ${frame.begin}${this.getUsername(context)}${frame.end} (${
              frame.price
            } points)`
        )
        .join(", ")
    );
  }

  buyFrameHandler(context: HandlerContext, args: string[]): string | undefined {
    const frameIndex = parseInt(args[1]);
    if (isNaN(frameIndex)) {
      return `Please provide a valid frame index, ${this.addressUser(context)}`;
    }
    if (frameIndex < 0) {
      this.userData.update(context["user-id"], (inPlaceValue) => {
        inPlaceValue.customFrameBegin = "";
        inPlaceValue.customFrameEnd = "";
        inPlaceValue.customFramePrice = 0;
      });
      return `${this.addressUser(context)} reset to no custom frame for free!`;
    }
    const frame = this.frames[frameIndex];
    if (!frame) {
      return `There is no frame with index ${frameIndex}, ${this.addressUser(
        context
      )}`;
    }
    this.userData.update(context["user-id"], (inPlaceValue) => {
      inPlaceValue.customFrameBegin = frame.begin.toString();
      inPlaceValue.customFrameEnd = frame.end.toString();
      inPlaceValue.customFramePrice = frame.price.valueOf();
    });
    return `${this.addressUser(
      context
    )} subscribed to a frame ${frameIndex} for ${frame.price} points/print!`;
  }

  private addressUserImpl(
    context: HandlerContext,
    args: { userId: String }
  ): string | undefined {
    const userId = args.userId.valueOf();
    const info = this.userData.get(userId);
    const frame = {
      begin: info.customFrameBegin,
      end: info.customFrameEnd,
      price: info.customFramePrice,
    };
    if (frame.price.valueOf() > 0) {
      const ensured = this.ensureBalance(
        context,
        userId,
        frame.price.valueOf()
      );
      if (typeof ensured === "string") {
        console.log(`* frame ${userId}: ${ensured}`);
        return undefined;
      }
    }
    console.log(
      `* frame ${userId}: ${frame.begin}${this.getUsername(context)}${
        frame.end
      }`
    );
    this.commitBalance(
      context,
      userId,
      frame.price.valueOf(),
      -frame.price.valueOf()
    );
    return `${frame.begin}${this.getUsername(context)}${frame.end}`;
  }
}
