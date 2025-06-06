import { TelegramClient } from "telegramsjs";
import dotenv from "dotenv";
import { trimIllustId, trimIllustCaption } from "./src/utils.js";
import probe from "probe-image-size";

dotenv.config();

// Token and URL
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PIXIV_REFRESH_TOKEN = process.env.PIXIV_REFRESH_TOKEN;
const PIXIV_CLIENT_ID = process.env.PIXIV_CLIENT_ID;
const PIXIV_CLIENT_SECRET = process.env.PIXIV_CLIENT_SECRET;
const PIXIV_REVERSE_PROXY_URL= process.env.PIXIV_REVERSE_PROXY_URL;

// Bot
const bot = new TelegramClient(TELEGRAM_BOT_TOKEN);

// Access token, I pre-fill it with an expired access token
const pixivAuth = {
    accessToken: "s3O-uH_Zkj2wyXP7d8QD0_QR2-GxTmMKEpa_XOCUI9o",
    createdTime: 0
}

// Refresh access token with refresh token
async function refreshPixivToken() {
    const now = Date.now();
    const age = (now - pixivAuth.createdTime) / 1000;

    // Only refresh when remaining time < 5 min
    if (pixivAuth.accessToken && age < 3300) {
        return pixivAuth.accessToken;
    }

    // Params should be posted as "client_id=PIXIV_CLIENT_ID&client_secret=PIXIV_CLIENT_SECRET&grant_type=refresh_token&refresh_token=PIXIV_REFRESH_TOKEN" in body
    // So you cannot post a JSON or XML
    const params = new URLSearchParams({
        client_id: PIXIV_CLIENT_ID,
        client_secret: PIXIV_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: PIXIV_REFRESH_TOKEN,
    });

    const response = await fetch("https://oauth.secure.pixiv.net/auth/token", {
        method: "POST",
        headers: {
            "App-Os": "Android",
            "App-Os-Version": "14.0",
            "App-Version": "6.140.1",
            "User-Agent": "PixivAndroidApp/6.140.1 (Android 14.0; Pixel 8)",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
    });

    const data = await response.json();
    if (!data.access_token) throw new Error("Failed to refresh Access token");

    pixivAuth.accessToken = data.access_token;
    pixivAuth.createdTime = now;

    return data.access_token;
}

// Use illustId to get the info of illustration
async function fetchIllustData(illustId) {
    // Prepare access token
    const accessToken = await refreshPixivToken();

    const response = await fetch(`https://app-api.pixiv.net/v1/illust/detail?illust_id=${illustId}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    const data = await response.json();
    // When illustId is not exist, return is { "error": {...} }
    if (!data.illust) {
        throw new Error("Cannot find the page");
    }
    return data.illust;
}

bot.on("inlineQuery", async (inlineQuery) => {
    // Get illustId
    const query = inlineQuery.query.trim();
    const illustId = trimIllustId(query);
    if (!illustId) {
        return inlineQuery.answerQuery([]);
    }
    // Get illustData in JSON
    let result;
    try {
        result = await fetchIllustData(illustId);
    } catch (error) {
        console.error(error);
    }
    if (!result) {
        return inlineQuery.answerQuery([]);
    }

    /*
    Illustration info:
    .id --> illust id
    .title --> illust title
    .caption --> description
    .width --> width, required for InlineQueryResultPhoto()
    .height --> height, required for InlineQueryResultPhoto()
    .type --> illust type, 
    .page_count --> total number of pictures in the illustration

    Illustration URL:
    When there is only one pic in illustration:
    .image_urls.medium --> use as thumb
    .meta_single_page.original_image_url --> original picture
    When there are multiple pics in illustration:
    .meta_pages --> multiple pictures

    Author info:
    .user.id --> user id
    .user.name --> user name
    */
   
    // Basic info of illustration
    const totalPages = result.page_count;
    const illustPageUrl = `https://www.pixiv.net/artworks/${illustId}`;
    const authorUrl = `https://www.pixiv.net/users/${result.user.id}`;
    const illustCaptionRaw = trimIllustCaption(result.caption);
    const illustCaption = `${result.title} by <a href="${authorUrl}">${result.user.name}</a>\n${illustPageUrl}\n${illustCaptionRaw}`;
    /*
    Specific info depends on it is one pic or multi pics, jpg or png
    Telegram Bot API InlineQueryResultPhoto only accept .jpg not exceed 5MB
    Try to get original pic unless it is .png or exceed 5MB
    image_urls.medium and image_urls.large always return an URL end with "_master1200.jpg".
    For multiple picture illustrations, we need to get width and height because Telegram Bot API need variables to display.
    Pixiv API only return the size of first picture in the illustration.
    Set 10000 as fallback. It is the maximum size Telegram Bot API accpets under inline mode.
    */
    try {
        if (totalPages === 1) {
            const verifyPic = await probe(result.meta_single_page.original_image_url.replace("https://i.pximg.net/", PIXIV_REVERSE_PROXY_URL));
            const illustOriginalUrl = (verifyPic.mime === "image/jpeg" && verifyPic.length <= 5000000) ? verifyPic.url : result.image_urls.large.replace("https://i.pximg.net/", PIXIV_REVERSE_PROXY_URL);
            const illustThumbUrl = result.image_urls.medium.replace("https://i.pximg.net/", PIXIV_REVERSE_PROXY_URL);
            
            const singleResult = [{
                type: "photo",
                parse_mode: "HTML",
                id: `${illustId}_0`,
                photo_file_id: `${illustId}_0`,
                photo_width: result.width,
                photo_height: result.height,
                photo_url: illustOriginalUrl,
                thumbnail_url: illustThumbUrl,
                caption: illustCaption
            }]
            await inlineQuery.answerQuery(singleResult);
        } else {
            // If you want to display all pages in the illustration, remove .slice().
            // By default I set it to display first 8 pages. It is enough for most of illustrations but it still could be timeout for some illustrations.
            // Since probe() can return content-type and content-length, I do not need to get return header twice.
            // It is not a good idea to download manga type illust because manga always has too many pages.
            const illustCaptionExtra = totalPages > 8 ? ", You should get all pages from Pixiv" : "";
            const results = await Promise.all(result.meta_pages.slice(0, 8).map(async (page, index) => {
                const verifyThisPic = await probe(page.image_urls.original.replace("https://i.pximg.net/", PIXIV_REVERSE_PROXY_URL));
                const illustOriginalUrl = (verifyThisPic.mime === "image/jpeg" && verifyThisPic.length <= 5000000) ? verifyThisPic.url : page.image_urls.large.replace("https://i.pximg.net/", PIXIV_REVERSE_PROXY_URL);
                const thisWidth = verifyThisPic?.width || 10000;
                const thisHeight = verifyThisPic?.height || 10000; 
                const illustThumbUrl = page.image_urls.medium.replace("https://i.pximg.net/", PIXIV_REVERSE_PROXY_URL);

                return {
                    type: "photo",
                    parse_mode: "HTML",
                    id: `${illustId}_${index}`,
                    photo_file_id: `${illustId}_${index}`,
                    photo_width: thisWidth,
                    photo_height: thisHeight,
                    photo_url: illustOriginalUrl,
                    thumbnail_url: illustThumbUrl,
                    caption: `${illustCaption}\n<b>This is the Page ${index+1} of ${totalPages}</b><b>${illustCaptionExtra}</b>`
                };
            }));
            await inlineQuery.answerQuery(results);
        }
    } catch (error) {
        console.error(error);
    }
});

bot.login();

// Global uncaught error handler
/*
Prevent TelegramsJS throw error such as

C:\Users\XXXXX\Code\telegram-bot-pixiv\node_modules\telegramsjs\dist\src\rest\Rest.js:86
            throw new HTTPResponseError_1.HTTPResponseError(response, request);
                  ^

ErrorResponse[400]: Bad Request: can't parse inline query result: Can't parse entities: Unexpected end of name token at byte offset 27
    at Rest.request (C:\Users\XXXXX\Code\telegram-bot-pixiv\node_modules\telegramsjs\dist\src\rest\Rest.js:86:19)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5) {
  description: "Bad Request: can't parse inline query result: Can't parse entities: Unexpected end of name token at byte offset 27",
  code: 400,
  parameters: undefined
}
*/
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
});