/* CLI to add a friend. Creates data/friends/<slug>/config.json from flags, then
   tells you where to drop the avatar(s). The birthdays DB rebuilds from configs
   on the next server start, so the new friend appears there automatically.

   Usage:
     bun run add-friend -- --slug bob --name "Боб" --username @bob \
       --birthday 12-25 --message "С днём рождения!" \
       [--accent "#7EC2E8"] [--games feed-fox,memory] \
       [--avatar avatar.jpg] [--puzzleAvatar avatar2.jpg] \
       [--giftName "Instant Ramen"] [--giftEmoji 🍜] [--giftLottie /gifts/x.json] \
       [--force]
*/
import fs from "node:fs";
import path from "node:path";

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const slug = flag("slug");
const name = flag("name");
const username = flag("username");
const birthday = flag("birthday");

if (!slug || !name || !username || !birthday) {
  console.error(
    `Usage: bun run add-friend -- --slug <slug> --name "<DisplayName>" --username <@user> --birthday <MM-DD|YYYY-MM-DD> [--message "..."] [--accent "#hex"] [--games a,b,c] [--avatar file] [--puzzleAvatar file] [--giftName ..] [--giftEmoji ..] [--giftLottie ..] [--force]`,
  );
  process.exit(1);
}

if (!/^[a-z0-9-]+$/.test(slug)) {
  console.error(`✗ slug must be lowercase letters/digits/dashes only (got "${slug}")`);
  process.exit(1);
}
if (!/^\d{1,2}-\d{1,2}$/.test(birthday) && !/^\d{4}-\d{1,2}-\d{1,2}$/.test(birthday)) {
  console.error(`✗ birthday must be MM-DD or YYYY-MM-DD (got "${birthday}")`);
  process.exit(1);
}

const games = (flag("games") ?? "feed-fox,catch-stars,slide-puzzle,memory,maze")
  .split(",")
  .map((g) => ({ gameId: g.trim() }))
  .filter((g) => g.gameId);

const config: Record<string, unknown> = {
  username,
  displayName: name,
  birthday,
  message: flag("message") ?? "С днём рождения! 🎉 Пусть всё будет тёплым и звёздным.",
  accent: flag("accent") ?? "#7EC2E8",
  games,
  avatar: flag("avatar") ?? "avatar.jpg",
};
if (flag("puzzleAvatar")) config.puzzleAvatar = flag("puzzleAvatar");

const giftEmoji = flag("giftEmoji");
const giftName = flag("giftName");
if (giftEmoji || giftName) {
  const gift: Record<string, string> = {
    name: giftName ?? "Подарок",
    emoji: giftEmoji ?? "🎁",
  };
  if (flag("giftLottie")) gift.lottie = flag("giftLottie")!;
  config.gift = gift;
}

const dir = path.resolve(import.meta.dir, "..", "data", "friends", slug);
const file = path.join(dir, "config.json");

if (fs.existsSync(file) && !has("force")) {
  console.error(`✗ ${file} already exists — pass --force to overwrite.`);
  process.exit(1);
}

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n", "utf-8");

console.log(`✓ Created ${file}`);
console.log(`→ Drop the avatar at: ${path.join(dir, String(config.avatar))}`);
if (config.puzzleAvatar) {
  console.log(`→ Drop the puzzle avatar at: ${path.join(dir, String(config.puzzleAvatar))}`);
}
console.log(`→ Page will be at /${slug} (restart the server to refresh the birthdays DB).`);
