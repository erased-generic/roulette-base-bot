export { UserDatum, UserData, FileUserData, MemoryUserData };

import * as fs from "fs";
import * as path from "path";
import {
  applySchema,
  combineSchemas,
  isValidBySchema,
  MappedSchema,
  Schema,
} from "./interfaces";

interface UserDatum {}

abstract class UserData<T> {
  protected readonly userData: { [key: string]: T };
  private schema: Schema = {};

  constructor(readUserData: () => any) {
    this.userData = readUserData();
  }

  withSchema<U extends Schema>(schema: U): UserData<MappedSchema<U>> {
    this.schema = combineSchemas(this.schema, schema);
    const self = this as UserData<MappedSchema<U>>;
    const userData = self.userData;
    for (const key in userData) {
      const withSchema = applySchema(userData[key], schema);
      if (isValidBySchema(withSchema, schema)) {
        userData[key] = withSchema;
      } else {
        console.log(
          `* invalid userData: ${key}: ${JSON.stringify(withSchema)}`
        );
      }
    }
    return self;
  }

  getDefaultData(): T {
    return applySchema({}, this.schema) as T;
  }

  get(userId: string): T {
    if (userId in this.userData) {
      return this.userData[userId];
    }
    return this.update(userId, (inPlaceValue, hadKey) => {});
  }

  update(
    userId: string,
    updater: (inPlaceValue: T, hadKey: boolean) => void
  ): T {
    let hadKey = true;
    if (!(userId in this.userData)) {
      this.userData[userId] = this.getDefaultData();
      hadKey = false;
    }
    const saved = this.userData[userId];
    updater(saved, hadKey);
    this.writeUserData();
    return saved;
  }

  getAll(): { [key: string]: T } {
    return this.userData;
  }

  abstract writeUserData(): void;
}

class FileUserData extends UserData<UserDatum> {
  readonly filePath: string;

  constructor(filePath: string) {
    super(() => {
      try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
      } catch (e) {
        if (e.code === "ENOENT") {
          return {};
        }
        throw e;
      }
    });
    this.filePath = filePath;
  }

  writeUserData() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.userData), "utf8");
  }
}

class MemoryUserData extends UserData<UserDatum> {
  constructor(init: any) {
    super(() => init);
  }

  writeUserData() {}
}
