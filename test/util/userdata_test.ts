import assert from "assert";
import { FileUserData } from "../../src/util/userdata";
import path from "path";
import * as fs from "fs";
import { defaultValue } from "../../src/util/interfaces";

const filePath = path.join(__dirname, "test.json");
fs.writeFileSync(
  filePath,
  JSON.stringify({ userId: { testPrev: "prev" } }),
  "utf8"
);
const userData = new FileUserData(filePath).withSchema({
  testPrev: defaultValue("defaultValue"),
  test: defaultValue(123),
});
assert.strictEqual(userData.get("userId").test, 123);
assert.strictEqual(userData.get("userId").testPrev, "prev");
userData.update("userId", (inPlaceValue) => {
  inPlaceValue.test = 456;
});
assert.strictEqual(userData.get("userId").test, 456);
assert.deepStrictEqual(JSON.parse(fs.readFileSync(filePath, "utf8")), {
  userId: { test: 456, testPrev: "prev" },
});

const userData2 = userData.withSchema({ test2: defaultValue(789) });
assert.strictEqual(userData.get("userId").test, 456);
assert.strictEqual(userData.get("userId")["test2"], 789);
assert.strictEqual(userData2.get("userId")["test"], 456);
assert.strictEqual(userData2.get("userId").test2, 789);

userData2.update("userId", (inPlaceValue) => {
  inPlaceValue.test2 = 123;
});
assert.strictEqual(userData.get("userId").test, 456);
assert.strictEqual(userData2.get("userId").test2, 123);
assert.deepStrictEqual(JSON.parse(fs.readFileSync(filePath, "utf8")), {
  userId: { test: 456, test2: 123, testPrev: "prev" },
});
