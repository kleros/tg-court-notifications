import * as TelegramBot from "node-telegram-bot-api";
import { isAddress, getAddress, JsonRpcProvider } from "ethers";
import { notificationSystem } from "../../config/supabase";
import { subscribe } from "../../assets/multilang.json";
import { commands } from "../../assets/multilang.json";
import env from "../../types/env";

/*
 * /subscribe
 */

let regexps: RegExp[] = [];

for (const lang in commands.subscribe) {
    regexps.push(new RegExp(`\/${commands.subscribe[lang as keyof typeof commands.subscribe]}`));
}

const regexpFull = /^\/(.+) (.+)/;
const max_subscriptions = 3;

const callback = async (bot: TelegramBot, msg: TelegramBot.Message, lang_code: string) => {
    const match = msg.text!.match(regexpFull);
    if (!match) {
        await bot.sendMessage(msg.chat.id, subscribe.no_match[lang_code as keyof typeof subscribe.no_match], {
            parse_mode: "Markdown",
        });
        return;
    }

    let address: string | undefined = undefined;

    if (match[2].startsWith("0x")) {
        if (!isAddress(match[2])) {
            await bot.sendMessage(msg.chat.id, subscribe.not_address[lang_code as keyof typeof subscribe.not_address]);
            return;
        }
        address = getAddress(match[2]);
    } else if (match[2].endsWith(".eth")) {
        const provider = new JsonRpcProvider(env.RPC_URL_MAINNET);
        const resp = await provider.resolveName(match[2]);
        if (!resp) {
            await bot.sendMessage(msg.chat.id, subscribe.not_ens[lang_code as keyof typeof subscribe.not_ens]);
            return;
        }
        address = resp;
    } else {
        await bot.sendMessage(msg.chat.id, subscribe.invalid[lang_code as keyof typeof subscribe.invalid], {
            parse_mode: "Markdown",
        });
        return;
    }

    const tgUserId = msg.from?.id;
    if (!tgUserId) {
        throw new Error("Telegram user id is undefined");
    }

    const count = await notificationSystem
        .from(`tg-juror-subscriptions`)
        .select("*", { count: "exact", head: true })
        .eq("tg_user_id", tgUserId);

    if (!count) return;

    if (count.count! > max_subscriptions) {
        await bot.sendMessage(msg.chat.id, subscribe.max_subs[lang_code as keyof typeof subscribe.max_subs]);
        return;
    }

    await bot.sendMessage(msg.chat.id, subscribe.thankyou[lang_code as keyof typeof subscribe.thankyou]);

    const result = await notificationSystem
        .from(`tg-juror-subscriptions`)
        .upsert({ tg_user_id: msg.from?.id as number, juror_address: address });

    console.log("Subscription results: ", JSON.stringify(result));
};

export { regexps, callback };
