/* CLI to record a gift you gave a friend. Appends to the friend's giftHistory
   in their config.json (and optionally makes it the current displayed gift).
   The history DB folds this in on the next server start.

   Usage:
     bun run add-gift -- --slug alumi --name "Instant Ramen" --emoji 🍜 \
       [--lottie /gifts/instant-ramen.json] [--link https://t.me/nft/InstantRamen-349224] \
       [--imagePath gift.jpg] [--date 2026-06-15] [--current]
*/
import fs from "node:fs";
import path from "node:path";

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

const slug = flag("slug");
const name = flag("name");
if (!slug || !name) {
  console.error(
    `Usage: bun run add-gift -- --slug <slug> --name "<gift>" [--emoji 🍜] [--lottie /gifts/x.json] [--link https://t.me/nft/...] [--imagePath file] [--date YYYY-MM-DD] [--current]`,
  );
  process.exit(1);
}

const file = path.resolve(import.meta.dir, "..", "data", "friends", slug, "config.json");
if (!fs.existsSync(file)) {
  console.error(`✗ ${file} not found — add the friend first (bun run add-friend).`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(file, "utf-8"));

const gift: Record<string, string> = { name };
if (flag("emoji")) gift.emoji = flag("emoji")!;
if (flag("lottie")) gift.lottie = flag("lottie")!;
if (flag("link")) gift.link = flag("link")!;
if (flag("imagePath")) gift.imagePath = flag("imagePath")!;

const historyEntry = { ...gift, date: flag("date") ?? new Date().toISOString().slice(0, 10) };
config.giftHistory = Array.isArray(config.giftHistory) ? config.giftHistory : [];
/* de-dupe by name */
config.giftHistory = config.giftHistory.filter((g: { name?: string }) => g?.name !== name);
config.giftHistory.push(historyEntry);

if (has("current")) {
  config.gift = { name, emoji: gift.emoji ?? "🎁" };
  if (gift.lottie) config.gift.lottie = gift.lottie;
  if (gift.link) config.gift.link = gift.link;
  if (gift.imagePath) config.gift.imagePath = gift.imagePath;
}

fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n", "utf-8");

console.log(`✓ Recorded gift "${name}" for ${slug} (history: ${config.giftHistory.length} total).`);
if (has("current")) console.log(`→ Set as the current displayed gift.`);
console.log(`→ Restart the server to fold it into the history DB.`);
