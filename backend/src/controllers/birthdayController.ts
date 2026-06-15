import BirthdayRepository from "../repositories/BirthdayRepository";
import Logger from "../utils/Logger";

/**
 * GET /api/birthdays — all friends' birthdays, soonest first (with daysUntil).
 * Handy for a future "upcoming birthdays" dashboard.
 */
export const getBirthdays = async ({ set }: any) => {
    try {
        set.status = 200;
        return { birthdays: BirthdayRepository.list() };
    } catch (error) {
        Logger.error("BirthdayController", `getBirthdays error: ${error}`);
        set.status = 500;
        return { error: "Internal server error" };
    }
};
