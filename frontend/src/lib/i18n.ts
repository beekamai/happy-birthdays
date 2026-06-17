/* Tiny dependency-free i18n. Mirrors the singleton + subscribe shape of sound.ts:
   one module-level `lang` state, a Set of listeners, localStorage persistence
   under `hb-lang`, and a `useT()` hook that re-renders subscribers on change.

   `ru` is the source of truth — every user-facing Russian string in the app
   lives here as a value. `en` holds the English of every key. A missing key
   returns the key itself (dev-visible); a missing `en` value falls back to `ru`,
   then to the key. `t(key, vars)` does simple `{var}` interpolation. */

import { useSyncExternalStore } from "react";

export type Lang = "ru" | "en";

export const LANGS: Lang[] = ["ru", "en"];

const STORAGE_KEY = "hb-lang";

/* ---- Dictionary ---------------------------------------------------------- */

const ru: Record<string, string> = {
  /* Generic loading */
  "loading.party": "Загружаем праздник…",
  "loading.default": "Загружаем…",
  "loading.game": "Загружаем игру…",

  /* Landing */
  "landing.title": "Happy Birthdays ✨",
  "landing.subtitle": "Тёплые странички ко дню рождения.",

  /* 404 */
  "notFound.title": "Упс, такой странички нет",
  "notFound.text": "Проверь ссылку — кажется, тут пусто.",

  /* Countdown */
  "countdown.today": "Сегодня твой день!",
  "countdown.until": "До дня рождения",
  "countdown.day.one": "день",
  "countdown.day.few": "дня",
  "countdown.day.many": "дней",

  /* Gift card */
  "gift.open": "Открыть подарок",
  "gift.youGot": "Тебе подарок:",

  /* Gift list */
  "giftList.title": "Подарки 🎁",
  "month.short.1": "янв",
  "month.short.2": "фев",
  "month.short.3": "мар",
  "month.short.4": "апр",
  "month.short.5": "мая",
  "month.short.6": "июн",
  "month.short.7": "июл",
  "month.short.8": "авг",
  "month.short.9": "сен",
  "month.short.10": "окт",
  "month.short.11": "ноя",
  "month.short.12": "дек",

  /* Games section + modal */
  "games.title": "Мини-игры 🎮",
  "games.close": "Закрыть",
  "games.best": "🏅 Рекорд: {n}",

  /* Game registry titles + blurbs */
  "game.feed-fox.title": "Покорми лисичку",
  "game.feed-fox.blurb": "Лови падающий рамён в корзинку",
  "game.catch-stars.title": "Лови звёзды",
  "game.catch-stars.blurb": "Собери падающие звёздочки",
  "game.slide-puzzle.title": "Пазл",
  "game.slide-puzzle.blurb": "Собери картинку из кусочков",
  "game.memory.title": "Найди пары",
  "game.memory.blurb": "Открывай карточки и ищи пары",
  "game.maze.title": "Путь к дружбе",
  "game.maze.blurb": "Пройди лабиринт навстречу другу",

  /* GameHost finish UI */
  "game.won": "Получилось!",
  "game.over": "Игра окончена",
  "game.scoreForGame": "Очки за игру:",
  "game.bestInGame": "Твой рекорд в игре:",
  "game.yourScore": "🏅 Твои очки:",
  "game.pageTotal": "🌍 всего на странице:",
  "game.playAgain": "Сыграть ещё",
  "game.close": "Закрыть",

  /* Catcher HUD */
  "catcher.timeLeft": "{n}с ⏳",

  /* Memory */
  "memory.moves": "Ходов: {n}",
  "memory.closedCard": "закрытая карточка",
  "memory.hint": "Открывай карточки и находи одинаковые пары",

  /* Maze */
  "maze.preparing": "готовим тропинку…",
  "maze.hint": "Стрелки или свайп — дойди до друга 🗺️",

  /* Slide puzzle */
  "puzzle.moves": "Ходов: {n}",
  "puzzle.empty": "пусто",
  "puzzle.piece": "кусочек {n}",
  "puzzle.showPicture": "👁 Показать картинку",
  "puzzle.hint": "💡 Подсказка",
  "puzzle.tip": "Собери картинку — двигай кусочки к пустой клетке",

  /* Pet */
  "pet.aria": "Питомец — погладь меня",

  /* Friend page */
  "friend.closingBanner":
    "🎂 День рождения уже прошёл — страничка будет доступна ещё {n} дн., потом закроется до следующего дня рождения.",
  "friend.yourScore": "Твои очки: {n}",
  "friend.pageTotal": "Всего на странице: {n}",
  "friend.footer": "с любовью, {name}",

  /* Generic confirm dialog */
  "dialog.cancel": "Отмена",
  "dialog.confirm": "Подтвердить",

  /* Account / login */
  "account.login": "Войти",
  "account.account": "Аккаунт",
  "account.profile": "🙋 Моя страница",
  "account.cabinet": "🛠️ Кабинет",
  "account.edit": "✏️ Редактировать",
  "account.logout": "Выйти",

  /* Profile page (/u/<slug>) */
  "hero.viewProfile": "Открыть профиль",
  "profile.points": "Очки: {n}",
  "profile.birthdayPage": "🎂 Страница поздравления",
  "profile.edit": "✏️ Редактировать",

  /* Shop (decoration store) */
  "shop.open": "🛍️ Магазин",
  "shop.title": "🛍️ Магазин украшений",
  "shop.close": "Закрыть",
  "shop.remaining": "Осталось {n}",
  "shop.spentOf": "Потрачено {spent} из {earned} — это общая копилка очков",
  "shop.cost": "{n} очков",
  "shop.buy": "Купить",
  "shop.owned": "Куплено",
  "shop.equip": "Надеть",
  "shop.unequip": "Снять",
  "shop.refund": "↩︎ Вернуть {n}",
  "shop.refundHint": "Удалить украшение и вернуть {n} очков",
  "shop.confirmRefundTitle": "Вернуть украшение?",
  "shop.confirmDelete": "Удалить",
  "shop.confirmRefund": "Удалить «{name}» и вернуть {n} очков?",
  "shop.needMore": "Не хватает {n} очков",
  "shop.empty": "Каталог пока пуст",
  "shop.section.avatarFrame": "Рамки аватара",
  "shop.section.background": "Фоны",
  "shop.section.badge": "Бейджи",
  "shop.section.effect": "Эффекты",
  "shop.section.companion": "Питомцы",
  "shop.toast.bought": "Куплено ✨",
  "shop.toast.equipped": "Надели 💛",
  "shop.toast.unequipped": "Сняли",
  "shop.toast.refunded": "Возвращено 💰",
  "shop.toast.notEnough": "Не хватает очков",
  "shop.toast.error": "Что-то пошло не так",

  /* Earn explainer (how points accrue) */
  "earn.title": "Как зарабатываются очки",
  "earn.intro":
    "Очки приносят гости, играя в мини-игры. Магазин (7400 очков) нельзя выкупить за один раз — нужен поток гостей и повторные игры.",
  "earn.step.best": "🥇 Лучшая игра: до 1000 очков за игру, всего до 5000 с пяти игр.",
  "earn.step.newVisitor":
    "🙋 Новый гость: около 40% от его результата, и чем больше новых гостей — тем меньше доля у каждого следующего.",
  "earn.step.replay":
    "🔁 Повтор той же игры: около 15% за первый повтор, и каждый следующий повтор приносит всё меньше.",
  "earn.deficit":
    "Поэтому до полного магазина (7400) можно добраться только постепенно — много гостей и повторов, а не одним идеальным заходом.",
  "earn.bars.best": "Первый раз — 100%",
  "earn.bars.newVisitor": "Новый гость — 40%↓",
  "earn.bars.replay": "Повтор — 15%↓",
  "earn.open": "ⓘ Как заработать очки",
  "earn.close": "Понятно",
  "earn.card.tooltip": "Повторы и каждый следующий гость приносят всё меньше очков",

  /* Locked page */
  "locked.opensOn": "Праздничная страничка откроется в день рождения",
  "locked.today": " — сегодня! 🎉",
  "locked.inDays": " — через {n} дн. 🎉",

  /* Sound toggle */
  "sound.on": "Включить звук",
  "sound.off": "Выключить звук",

  /* Theme switcher */
  "theme.change": "Сменить тему",
  "theme.light": "Светлая",
  "theme.dark": "Тёмная",
  "theme.halloween": "Хэллоуин",
  "theme.newyear": "Новый год",

  /* Language switcher */
  "lang.switch": "Сменить язык",
  "lang.ru": "РУ",
  "lang.en": "EN",

  /* ---- Cabinet: shell + login ---- */
  "admin.brand": "Happy Birthdays",
  "admin.login.title": "Вход",
  "admin.login.subtitle": "Войди через Telegram, чтобы настроить свою страничку.",
  "admin.login.configError": "Не удалось загрузить настройки входа.",
  "admin.logout": "Выйти",
  "admin.you": "ты",
  "admin.searchingPage": "Ищем твою страничку…",
  "admin.myPages.title": "Твои странички",
  "admin.noPage.title": "У тебя пока нет странички",
  "admin.noPage.text": "Когда владелец создаст её — сможешь редактировать тут.",

  /* Telegram login */
  "tg.loginFailed": "Не удалось войти, попробуй ещё раз",
  "tg.notConfigured": "Telegram-вход ещё не настроен — добавь",
  "tg.notConfiguredEnv": "в .env",
  "tg.signingIn": "Входим…",

  /* State badge */
  "state.open": "🎉 открыта",
  "state.closing": "🎂 закрывается",
  "state.locked": "🔒 закрыта",

  /* ---- Owner dashboard ---- */
  "dashboard.title": "Странички",
  "dashboard.subtitle": "Управляй поздравлениями друзей.",
  "dashboard.create": "➕ Создать страничку",
  "dashboard.reorderHint": "Перетаскивай карточки за ручку ⠿, чтобы изменить порядок",
  "dashboard.orderSaved": "Порядок сохранён",
  "dashboard.loading": "Собираем странички…",
  "dashboard.empty.title": "Пока пусто",
  "dashboard.empty.text": "Создай первую страничку — будет тепло.",
  "dashboard.coverage": "Переводы: RU {ru}% · EN {en}%",

  /* ---- Friend editor ---- */
  "editor.game.feed-fox": "🦊 Накорми лису",
  "editor.game.catch-stars": "⭐ Лови звёзды",
  "editor.game.slide-puzzle": "🧩 Пятнашки",
  "editor.game.memory": "🃏 Память",
  "editor.game.maze": "🌀 Лабиринт",
  "editor.loading": "Открываем страничку…",
  "editor.notFound.title": "Странички нет",
  "editor.notFound.text": "Не нашли такую — может, ссылка устарела.",
  "editor.back": "← Назад",
  "editor.toBack": "← К списку",
  "editor.toast.avatarDeferred": "Аватар загрузится после создания странички",
  "editor.toast.avatarUploaded": "Аватар загружен 🖼️",
  "editor.toast.avatarFailed": "Не вышло загрузить аватар",
  "editor.toast.avatarNeeded": "Выбери главный аватар перед созданием",
  "editor.toast.giftAnimUploaded": "Анимация загружена 🎬",
  "editor.toast.giftAnimFailed": "Не вышло загрузить анимацию",
  "editor.toast.giftAnimInvalid": "Это не похоже на Lottie/TGS",
  "editor.toast.giftAnimTooBig": "Файл слишком большой (макс 2 МБ)",
  "editor.validation.required": "Заполни это поле",
  "editor.validation.name": "Впиши имя",
  "editor.validation.username": "Впиши Telegram-username",
  "editor.validation.birthday": "Дата рождения: ММ-ДД или ГГГГ-ММ-ДД",
  "editor.validation.message": "Впиши поздравление",
  "editor.validation.avatar": "Нужен главный аватар",
  "editor.validation.fix": "Проверь выделенные поля",
  "editor.toast.created": "Страничка создана 🎉",
  "editor.toast.saved": "Сохранили 💛",
  "editor.toast.saveFailed": "Не удалось сохранить",
  "editor.toast.deleted": "Страничка удалена 🗑",
  "editor.toast.deleteFailed": "Не удалось удалить",
  "editor.title.new": "Новая страничка",
  "editor.title.mine": "Моя страничка",
  "editor.section.basic": "👤 Основное",
  "editor.field.name": "Имя",
  "editor.placeholder.name": "Алуми",
  "editor.field.username": "Telegram username",
  "editor.hint.username": "С @ или без — например @alumi",
  "editor.placeholder.username": "@alumi",
  "editor.field.slug": "Слаг (адрес странички)",
  "editor.hint.slug": "Будет: /{slug}",
  "editor.hint.slugEmpty": "Заполни username — слаг подставится сам",
  "editor.placeholder.slug": "alumi",
  "editor.field.birthday": "Дата рождения",
  "editor.hint.birthday": "ММ-ДД (07-21) или с годом ГГГГ-ММ-ДД (2001-07-21)",
  "editor.placeholder.birthday": "07-21",
  "editor.field.message": "Поздравление",
  "editor.placeholder.message": "Тёплые слова имениннику…",
  "editor.field.bio": "О себе",
  "editor.field.bio.hint": "Пара строк для личной странички /u/<slug>",
  "editor.placeholder.bio": "Кто ты, чем живёшь…",
  "editor.section.socials": "🔗 Соцсети",
  "editor.socials.add": "➕ Добавить ссылку",
  "editor.socials.platform": "Платформа",
  "editor.socials.url": "Ссылка",
  "editor.socials.remove": "Удалить ссылку",
  "editor.field.accent": "Цвет-акцент",
  "editor.hint.accent": "Подкрашивает кнопки и рамки",
  "editor.section.avatars": "🖼️ Аватары",
  "editor.field.avatarMain": "Главный аватар",
  "editor.field.avatarPuzzle": "Аватар для пазла (необязательно)",
  "editor.avatarPick": "📷 Выбрать",
  "editor.section.gift": "🎁 Подарок",
  "editor.field.giftName": "Название",
  "editor.placeholder.giftName": "Подарочный NFT",
  "editor.giftName.default": "Подарок",
  "editor.field.giftEmoji": "Эмодзи",
  "editor.placeholder.giftEmoji": "🎁",
  "editor.field.giftAnim": "Анимация подарка",
  "editor.giftAnim.pick": "Загрузить .tgs / .json",
  "editor.giftAnim.hint": "Telegram-стикер .tgs или Lottie .json — путь подставится сам",
  "editor.giftAnim.manual": "…или вписать путь вручную",
  "editor.giftAnim.needSave": "Сначала сохрани страничку — потом сможешь загрузить",
  "editor.field.giftLottie": "Lottie (необязательно)",
  "editor.placeholder.giftLottie": "имя_анимации.json",
  "editor.field.giftLink": "Ссылка (необязательно)",
  "editor.placeholder.giftLink": "https://t.me/nft/…",
  "editor.gift.add": "+ Добавить подарок",
  "editor.gift.delete": "Удалить подарок",
  "editor.gift.makeCurrent": "Сделать текущим",
  "editor.gift.current": "Текущий",
  "editor.gift.date": "Дата",
  "editor.gift.empty": "Пока нет подарков — добавь первый",
  "editor.gift.reorderHint": "Перетаскивай за ⠿, чтобы менять порядок",
  "editor.section.games": "🎮 Игры",
  "editor.section.settings": "⚙️ Настройки",
  "editor.field.gamesEnabled": "Игры включены",
  "editor.field.giftDisplay": "Показ подарков",
  "editor.giftDisplay.current": "Только текущий",
  "editor.giftDisplay.all": "Вся история",
  "editor.field.socialStyle": "Стиль соцсетей",
  "editor.socialStyle.icon": "С иконками",
  "editor.socialStyle.iconOnly": "Только иконки",
  "editor.socialStyle.text": "Без иконок",
  "editor.field.giftLayout": "Раскладка подарков",
  "editor.giftLayout.list": "Список",
  "editor.giftLayout.blocks": "Блоки",
  "editor.field.lang": "Язык страницы",
  "editor.lang.ru": "Русский",
  "editor.lang.en": "English",
  "editor.field.theme": "Тема",
  "editor.theme.light": "🌞 Светлая",
  "editor.theme.dark": "🌙 Тёмная",
  "editor.theme.halloween": "🎃 Хэллоуин",
  "editor.theme.newyear": "🎄 Новый год",
  "editor.saving": "Сохраняем…",
  "editor.save.create": "🎉 Создать",
  "editor.save.update": "💾 Сохранить",
  "editor.delete": "🗑 Удалить страничку",
  "editor.delete.title": "Удалить страничку?",
  "editor.delete.text": "«{name}» и личный профиль будут удалены навсегда. Это необратимо.",
  "editor.delete.confirm": "Удалить навсегда",
  "editor.preview.label": "👀 Превью (сохранённое состояние)",
  "editor.preview.title": "Превью странички",
  "editor.preview.empty": "Создай страничку — и тут появится живое превью.",

  /* Translation panel */
  "editor.section.translation": "🌐 Перевод на {lang}",
  "editor.translation.hint": "Авторские поля на текущем языке, тут — второй язык.",
  "editor.translation.note": "Перевод сохраняется как есть. Нажми, чтобы сгенерировать.",
  "editor.translation.translate": "🔄 Перевести",
  "editor.translation.translating": "Переводим…",
  "editor.field.giftName.translation": "Название подарка",
  "editor.toast.translated": "Перевод готов ✨",
  "editor.toast.translateFailed": "Не вышло перевести",

  /* About page + home navigation */
  "about.title": "О проекте",
  "about.intro":
    "Happy Birthdays — уютные многоразовые странички-поздравления ко дню рождения: с подарками, мини-играми и личными профилями.",
  "about.hostingTitle": "Хостинг",
  "about.hosting": "Сайт живёт на серверах senko.digital.",
  "about.statsTitle": "Сейчас на сайте",
  "about.statsPages": "{n} праздничных страничек",
  "about.thanksTitle": "Благодарности",
  "about.thanks": "Сделано с инструментами Anthropic (Claude) для разработки 🖤",
  "about.back": "← На главную",
  "watermark.about": "о проекте",
  "nav.home": "🍜 На главную",
};

const en: Record<string, string> = {
  /* Generic loading */
  "loading.party": "Loading the party…",
  "loading.default": "Loading…",
  "loading.game": "Loading the game…",

  /* Landing */
  "landing.title": "Happy Birthdays ✨",
  "landing.subtitle": "Cozy little birthday pages.",

  /* 404 */
  "notFound.title": "Oops, no such page",
  "notFound.text": "Check the link — looks like it's empty here.",

  /* Countdown */
  "countdown.today": "Today is your day!",
  "countdown.until": "Until birthday",
  "countdown.day.one": "day",
  "countdown.day.few": "days",
  "countdown.day.many": "days",

  /* Gift card */
  "gift.open": "Open the gift",
  "gift.youGot": "A gift for you:",

  /* Gift list */
  "giftList.title": "Gifts 🎁",
  "month.short.1": "Jan",
  "month.short.2": "Feb",
  "month.short.3": "Mar",
  "month.short.4": "Apr",
  "month.short.5": "May",
  "month.short.6": "Jun",
  "month.short.7": "Jul",
  "month.short.8": "Aug",
  "month.short.9": "Sep",
  "month.short.10": "Oct",
  "month.short.11": "Nov",
  "month.short.12": "Dec",

  /* Games section + modal */
  "games.title": "Mini-games 🎮",
  "games.close": "Close",
  "games.best": "🏅 Best: {n}",

  /* Game registry titles + blurbs */
  "game.feed-fox.title": "Feed the fox",
  "game.feed-fox.blurb": "Catch the falling ramen in the basket",
  "game.catch-stars.title": "Catch the stars",
  "game.catch-stars.blurb": "Collect the falling stars",
  "game.slide-puzzle.title": "Puzzle",
  "game.slide-puzzle.blurb": "Reassemble the picture from pieces",
  "game.memory.title": "Find the pairs",
  "game.memory.blurb": "Flip cards and find matching pairs",
  "game.maze.title": "Path to friendship",
  "game.maze.blurb": "Walk the maze toward your friend",

  /* GameHost finish UI */
  "game.won": "You did it!",
  "game.over": "Game over",
  "game.scoreForGame": "Score this game:",
  "game.bestInGame": "Your best in this game:",
  "game.yourScore": "🏅 Your score:",
  "game.pageTotal": "🌍 page total:",
  "game.playAgain": "Play again",
  "game.close": "Close",

  /* Catcher HUD */
  "catcher.timeLeft": "{n}s ⏳",

  /* Memory */
  "memory.moves": "Moves: {n}",
  "memory.closedCard": "face-down card",
  "memory.hint": "Flip cards and find matching pairs",

  /* Maze */
  "maze.preparing": "preparing the path…",
  "maze.hint": "Arrows or swipe — reach your friend 🗺️",

  /* Slide puzzle */
  "puzzle.moves": "Moves: {n}",
  "puzzle.empty": "empty",
  "puzzle.piece": "piece {n}",
  "puzzle.showPicture": "👁 Show picture",
  "puzzle.hint": "💡 Hint",
  "puzzle.tip": "Solve the picture — slide pieces toward the empty cell",

  /* Pet */
  "pet.aria": "Pet — give me a pat",

  /* Friend page */
  "friend.closingBanner":
    "🎂 The birthday has passed — this page stays open for {n} more day(s), then closes until the next birthday.",
  "friend.yourScore": "Your score: {n}",
  "friend.pageTotal": "Page total: {n}",
  "friend.footer": "with love, {name}",

  /* Generic confirm dialog */
  "dialog.cancel": "Cancel",
  "dialog.confirm": "Confirm",

  /* Account / login */
  "account.login": "Log in",
  "account.account": "Account",
  "account.profile": "🙋 My page",
  "account.cabinet": "🛠️ Cabinet",
  "account.edit": "✏️ Edit",
  "account.logout": "Log out",

  /* Profile page (/u/<slug>) */
  "hero.viewProfile": "Open profile",
  "profile.points": "Points: {n}",
  "profile.birthdayPage": "🎂 Birthday page",
  "profile.edit": "✏️ Edit",

  /* Shop (decoration store) */
  "shop.open": "🛍️ Shop",
  "shop.title": "🛍️ Decoration shop",
  "shop.close": "Close",
  "shop.remaining": "{n} left",
  "shop.spentOf": "Spent {spent} of {earned} — one shared points pool",
  "shop.cost": "{n} points",
  "shop.buy": "Buy",
  "shop.owned": "Owned",
  "shop.equip": "Equip",
  "shop.unequip": "Unequip",
  "shop.refund": "↩︎ Refund {n}",
  "shop.refundHint": "Remove the decoration and refund {n} points",
  "shop.confirmRefundTitle": "Refund decoration?",
  "shop.confirmDelete": "Remove",
  "shop.confirmRefund": "Remove “{name}” and refund {n} points?",
  "shop.needMore": "Need {n} more points",
  "shop.empty": "The catalogue is empty for now",
  "shop.section.avatarFrame": "Avatar frames",
  "shop.section.background": "Backgrounds",
  "shop.section.badge": "Badges",
  "shop.section.effect": "Effects",
  "shop.section.companion": "Companions",
  "shop.toast.bought": "Bought ✨",
  "shop.toast.equipped": "Equipped 💛",
  "shop.toast.unequipped": "Unequipped",
  "shop.toast.refunded": "Refunded 💰",
  "shop.toast.notEnough": "Not enough points",
  "shop.toast.error": "Something went wrong",

  /* Earn explainer (how points accrue) */
  "earn.title": "How points are earned",
  "earn.intro":
    "Guests earn points by playing the mini-games. The shop (7400 points) can't be bought out at once — it takes a stream of guests and replays.",
  "earn.step.best": "🥇 Best run: up to 1000 points per game, up to 5000 across all five.",
  "earn.step.newVisitor":
    "🙋 A new guest: about 40% of their score, and the more new guests arrive, the smaller each next share.",
  "earn.step.replay":
    "🔁 Replaying the same game: about 15% for the first replay, and every further replay gives less.",
  "earn.deficit":
    "So the full shop (7400) is only reachable gradually — many guests and replays, never in one perfect session.",
  "earn.bars.best": "First time — 100%",
  "earn.bars.newVisitor": "New guest — 40%↓",
  "earn.bars.replay": "Replay — 15%↓",
  "earn.open": "ⓘ How earning works",
  "earn.close": "Got it",
  "earn.card.tooltip": "Replays and each next guest earn progressively fewer points",

  /* Locked page */
  "locked.opensOn": "The festive page opens on the birthday",
  "locked.today": " — today! 🎉",
  "locked.inDays": " — in {n} day(s) 🎉",

  /* Sound toggle */
  "sound.on": "Turn sound on",
  "sound.off": "Turn sound off",

  /* Theme switcher */
  "theme.change": "Change theme",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "theme.halloween": "Halloween",
  "theme.newyear": "New Year",

  /* Language switcher */
  "lang.switch": "Change language",
  "lang.ru": "РУ",
  "lang.en": "EN",

  /* ---- Cabinet: shell + login ---- */
  "admin.brand": "Happy Birthdays",
  "admin.login.title": "Sign in",
  "admin.login.subtitle": "Sign in with Telegram to set up your page.",
  "admin.login.configError": "Couldn't load sign-in settings.",
  "admin.logout": "Log out",
  "admin.you": "you",
  "admin.searchingPage": "Looking for your page…",
  "admin.myPages.title": "Your pages",
  "admin.noPage.title": "You don't have a page yet",
  "admin.noPage.text": "Once the owner creates it — you'll be able to edit it here.",

  /* Telegram login */
  "tg.loginFailed": "Couldn't sign in, please try again",
  "tg.notConfigured": "Telegram sign-in isn't set up yet — add",
  "tg.notConfiguredEnv": "to .env",
  "tg.signingIn": "Signing in…",

  /* State badge */
  "state.open": "🎉 open",
  "state.closing": "🎂 closing",
  "state.locked": "🔒 locked",

  /* ---- Owner dashboard ---- */
  "dashboard.title": "Pages",
  "dashboard.subtitle": "Manage your friends' greetings.",
  "dashboard.create": "➕ Create a page",
  "dashboard.reorderHint": "Drag cards by the ⠿ handle to reorder",
  "dashboard.orderSaved": "Order saved",
  "dashboard.loading": "Gathering pages…",
  "dashboard.empty.title": "Nothing here yet",
  "dashboard.empty.text": "Create the first page — it'll be cozy.",
  "dashboard.coverage": "Translations: RU {ru}% · EN {en}%",

  /* ---- Friend editor ---- */
  "editor.game.feed-fox": "🦊 Feed the fox",
  "editor.game.catch-stars": "⭐ Catch the stars",
  "editor.game.slide-puzzle": "🧩 Sliding puzzle",
  "editor.game.memory": "🃏 Memory",
  "editor.game.maze": "🌀 Maze",
  "editor.loading": "Opening the page…",
  "editor.notFound.title": "No such page",
  "editor.notFound.text": "Couldn't find it — maybe the link is outdated.",
  "editor.back": "← Back",
  "editor.toBack": "← To the list",
  "editor.toast.avatarDeferred": "The avatar will upload once the page is created",
  "editor.toast.avatarUploaded": "Avatar uploaded 🖼️",
  "editor.toast.avatarFailed": "Couldn't upload the avatar",
  "editor.toast.giftAnimUploaded": "Animation uploaded 🎬",
  "editor.toast.giftAnimFailed": "Couldn't upload the animation",
  "editor.toast.giftAnimInvalid": "That doesn't look like a Lottie/TGS",
  "editor.toast.giftAnimTooBig": "File too large (max 2 MB)",
  "editor.toast.avatarNeeded": "Choose the main avatar before creating",
  "editor.validation.required": "This field is required",
  "editor.validation.name": "Enter a name",
  "editor.validation.username": "Enter a Telegram username",
  "editor.validation.birthday": "Birthday: MM-DD or YYYY-MM-DD",
  "editor.validation.message": "Enter a greeting",
  "editor.validation.avatar": "A main avatar is required",
  "editor.validation.fix": "Check the highlighted fields",
  "editor.toast.created": "Page created 🎉",
  "editor.toast.saved": "Saved 💛",
  "editor.toast.saveFailed": "Couldn't save",
  "editor.toast.deleted": "Page deleted 🗑",
  "editor.toast.deleteFailed": "Couldn't delete",
  "editor.title.new": "New page",
  "editor.title.mine": "My page",
  "editor.section.basic": "👤 Basics",
  "editor.field.name": "Name",
  "editor.placeholder.name": "Alumi",
  "editor.field.username": "Telegram username",
  "editor.hint.username": "With or without @ — e.g. @alumi",
  "editor.placeholder.username": "@alumi",
  "editor.field.slug": "Slug (page address)",
  "editor.hint.slug": "Will be: /{slug}",
  "editor.hint.slugEmpty": "Fill in the username — the slug fills itself",
  "editor.placeholder.slug": "alumi",
  "editor.field.birthday": "Birthday",
  "editor.hint.birthday": "MM-DD (07-21) or with year YYYY-MM-DD (2001-07-21)",
  "editor.placeholder.birthday": "07-21",
  "editor.field.message": "Greeting",
  "editor.placeholder.message": "Warm words for the birthday person…",
  "editor.field.bio": "About",
  "editor.field.bio.hint": "A couple of lines for the personal page /u/<slug>",
  "editor.placeholder.bio": "Who you are, what you're into…",
  "editor.section.socials": "🔗 Socials",
  "editor.socials.add": "➕ Add link",
  "editor.socials.platform": "Platform",
  "editor.socials.url": "Link",
  "editor.socials.remove": "Remove link",
  "editor.field.accent": "Accent color",
  "editor.hint.accent": "Tints buttons and borders",
  "editor.section.avatars": "🖼️ Avatars",
  "editor.field.avatarMain": "Main avatar",
  "editor.field.avatarPuzzle": "Puzzle avatar (optional)",
  "editor.avatarPick": "📷 Choose",
  "editor.section.gift": "🎁 Gift",
  "editor.field.giftName": "Name",
  "editor.placeholder.giftName": "Gift NFT",
  "editor.giftName.default": "Gift",
  "editor.field.giftEmoji": "Emoji",
  "editor.placeholder.giftEmoji": "🎁",
  "editor.field.giftAnim": "Gift animation",
  "editor.giftAnim.pick": "Upload .tgs / .json",
  "editor.giftAnim.hint": "A Telegram .tgs sticker or Lottie .json — the path is filled in for you",
  "editor.giftAnim.manual": "…or enter a path manually",
  "editor.giftAnim.needSave": "Save the page first — then you can upload",
  "editor.field.giftLottie": "Lottie (optional)",
  "editor.placeholder.giftLottie": "animation_name.json",
  "editor.field.giftLink": "Link (optional)",
  "editor.placeholder.giftLink": "https://t.me/nft/…",
  "editor.gift.add": "+ Add gift",
  "editor.gift.delete": "Delete gift",
  "editor.gift.makeCurrent": "Make current",
  "editor.gift.current": "Current",
  "editor.gift.date": "Date",
  "editor.gift.empty": "No gifts yet — add the first",
  "editor.gift.reorderHint": "Drag the ⠿ handle to reorder",
  "editor.section.games": "🎮 Games",
  "editor.section.settings": "⚙️ Settings",
  "editor.field.gamesEnabled": "Games enabled",
  "editor.field.giftDisplay": "Gift display",
  "editor.giftDisplay.current": "Current only",
  "editor.giftDisplay.all": "Full history",
  "editor.field.socialStyle": "Socials style",
  "editor.socialStyle.icon": "With icons",
  "editor.socialStyle.iconOnly": "Icons only",
  "editor.socialStyle.text": "Text only",
  "editor.field.giftLayout": "Gift layout",
  "editor.giftLayout.list": "List",
  "editor.giftLayout.blocks": "Blocks",
  "editor.field.lang": "Page language",
  "editor.lang.ru": "Русский",
  "editor.lang.en": "English",
  "editor.field.theme": "Theme",
  "editor.theme.light": "🌞 Light",
  "editor.theme.dark": "🌙 Dark",
  "editor.theme.halloween": "🎃 Halloween",
  "editor.theme.newyear": "🎄 New Year",
  "editor.saving": "Saving…",
  "editor.save.create": "🎉 Create",
  "editor.save.update": "💾 Save",
  "editor.delete": "🗑 Delete page",
  "editor.delete.title": "Delete page?",
  "editor.delete.text": "“{name}” and the personal profile will be permanently deleted. This can't be undone.",
  "editor.delete.confirm": "Delete forever",
  "editor.preview.label": "👀 Preview (saved state)",
  "editor.preview.title": "Page preview",
  "editor.preview.empty": "Create the page — a live preview will appear here.",

  /* Translation panel */
  "editor.section.translation": "🌐 Translation into {lang}",
  "editor.translation.hint": "Author fields are in the page language; here is the other language.",
  "editor.translation.note": "Translations are saved as-is. Click to generate.",
  "editor.translation.translate": "🔄 Translate",
  "editor.translation.translating": "Translating…",
  "editor.field.giftName.translation": "Gift name",
  "editor.toast.translated": "Translation ready ✨",
  "editor.toast.translateFailed": "Couldn't translate",

  /* About page + home navigation */
  "about.title": "About",
  "about.intro":
    "Happy Birthdays — cozy, reusable birthday greeting pages: with gifts, mini-games and personal profiles.",
  "about.hostingTitle": "Hosting",
  "about.hosting": "This site is hosted on senko.digital servers.",
  "about.statsTitle": "Live right now",
  "about.statsPages": "{n} birthday pages",
  "about.thanksTitle": "Credits",
  "about.thanks": "Built with Anthropic's Claude developer tools 🖤",
  "about.back": "← Home",
  "watermark.about": "about",
  "nav.home": "🍜 Home",
};

export const translations: { ru: Record<string, string>; en: Record<string, string> } = {
  ru,
  en,
};

/* ---- Singleton state + subscribe ----------------------------------------- */

let lang: Lang = "ru";
const listeners = new Set<() => void>();

function isLang(v: unknown): v is Lang {
  return v === "ru" || v === "en";
}

try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (isLang(raw)) lang = raw;
} catch {
  /* private mode — default ru */
}

function emit(): void {
  for (const fn of listeners) fn();
}

/** The active language. */
export function getLang(): Lang {
  return lang;
}

/** Switch language and persist. No-op if unchanged. */
export function setLang(next: Lang): void {
  if (next === lang) return;
  lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore — language still applies for this session */
  }
  emit();
}

/** Subscribe to language changes; returns an unsubscribe. */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Set the initial language: a stored per-visitor override wins, otherwise the
 * passed default (the friend's configured page language). Call once from a page.
 * Never overrides an existing stored choice.
 */
export function initLang(defaultLang: Lang): void {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  const next = isLang(stored) ? stored : defaultLang;
  if (next !== lang) {
    lang = next;
    emit();
  }
}

/* ---- Translate ----------------------------------------------------------- */

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, key: string) =>
    key in vars ? String(vars[key]) : m,
  );
}

/**
 * Translate `key` in the active language with `{var}` interpolation. Falls back
 * en→ru→key so a missing English value still shows Russian, and an unknown key
 * is returned verbatim (dev-visible).
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const dict = translations[lang];
  const value = dict[key] ?? (lang === "en" ? ru[key] : undefined) ?? key;
  return interpolate(value, vars);
}

/* ---- React hook ---------------------------------------------------------- */

interface UseTResult {
  t: typeof t;
  lang: Lang;
  setLang: (l: Lang) => void;
  langs: Lang[];
}

/**
 * Read translations from a component and re-render it on language change.
 * Returns the bound `t`, the active `lang`, a persisting `setLang`, and the
 * full `langs` list.
 */
export function useT(): UseTResult {
  const current = useSyncExternalStore(subscribe, getLang, getLang);
  return { t, lang: current, setLang, langs: LANGS };
}

/* ---- Coverage (admin) ---------------------------------------------------- */

/** Share of keys with a non-empty string per locale, as 0..100 percentages. */
export function coverage(): { ru: number; en: number } {
  const keys = new Set([...Object.keys(ru), ...Object.keys(en)]);
  const total = keys.size || 1;
  let ruHit = 0;
  let enHit = 0;
  for (const k of keys) {
    if (ru[k]?.trim()) ruHit++;
    if (en[k]?.trim()) enHit++;
  }
  return {
    ru: Math.round((ruHit / total) * 100),
    en: Math.round((enHit / total) * 100),
  };
}
