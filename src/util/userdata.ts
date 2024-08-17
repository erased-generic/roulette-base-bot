export { UserDatum, UserData, FileUserData, MemoryUserData };

import * as fs from 'fs';
import * as path from 'path';

interface UserDatum {
  username?: string;
}

abstract class UserData<T extends UserDatum> {
  readonly userData: { [key: string]: T } = {};
  readonly onReadValue: (userId: string, read: any) => T;

  constructor(onReadValue: (userId: string, read: any) => T, readUserData: () => any) {
    this.onReadValue = onReadValue;
    const parsedData = readUserData();
    for (const key in parsedData) {
      const filledData = onReadValue(key, parsedData[key]);
      this.userData[key] = filledData;
    }
  }

  get(userId: string): T {
    if (userId in this.userData) {
      return this.userData[userId];
    }
    return this.update(userId, (inPlaceValue, hadKey) => {});
  }

  update(userId: string, updater: (inPlaceValue: T, hadKey: boolean) => void): T {
    let hadKey = true;
    if (!(userId in this.userData)) {
      this.userData[userId] = this.onReadValue(userId, {});
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

class FileUserData<T> extends UserData<T> {
  readonly filePath: string;

  constructor(onReadValue: (userId: string, read: any) => T, filePath: string) {
    super(onReadValue, () => {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (e) {
        if (e.code === 'ENOENT') {
          return {};
        }
        throw e;
      }
    });
    this.filePath = filePath;
  }

  writeUserData() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.userData), 'utf8');
  }
}

class MemoryUserData<T> extends UserData<T> {
  constructor(onReadValue: (userId: string, read: any) => T, init: any) {
    super(onReadValue, () => init);
  }

  writeUserData() {}
}
