import fs from "node:fs";

import { PORT, HOSTNAME, BASE_URL, OG_CACHE_DIR } from "./config/constants";
import ScoreRepository from "./repositories/ScoreRepository";
import BirthdayRepository from "./repositories/BirthdayRepository";
import HistoryRepository from "./repositories/HistoryRepository";
import FriendRepository from "./repositories/FriendRepository";
import PageRenderService from "./services/pageRenderService";
import Logger from "./utils/Logger";
import app from "./app";

/* Initialise persistence + cache dirs + the SPA shell, then start serving. */
ScoreRepository.init();
BirthdayRepository.init();
HistoryRepository.init();

/* Rebuild the birthdays index + history from the friend configs on boot, so the
   DBs never drift: birthdays mirror configs, gift history is folded in, and any
   name/handle/avatar change since last boot is recorded. */
const friends = FriendRepository.findAll();
BirthdayRepository.syncFromFriends(friends);
for (const f of friends) {
    const cfg = FriendRepository.getRawConfig(f.slug);
    if (!cfg) continue;
    HistoryRepository.syncProfile(f.slug, {
        displayName: cfg.displayName,
        username: cfg.username,
        avatar: cfg.avatar,
    });
    HistoryRepository.syncGifts(f.slug, [
        ...(cfg.gift ? [cfg.gift] : []),
        ...(cfg.giftHistory ?? []),
    ]);
}

await PageRenderService.init();

try {
    fs.mkdirSync(OG_CACHE_DIR, { recursive: true });
} catch (error) {
    Logger.warn("Startup", `could not create OG cache dir: ${error}`, { OG_CACHE_DIR });
}

app.listen({ port: PORT, hostname: HOSTNAME }, () => {
    Logger.info("Startup", "Birthday backend listening", {
        host: HOSTNAME,
        port: PORT,
        baseUrl: BASE_URL,
        htmlAvailable: PageRenderService.isHtmlAvailable(),
    });
});
