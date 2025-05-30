import { TelegramClient } from "telegramsjs";
import dotenv from "dotenv";

dotenv.config();

// Token
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

// Regex match illust_id= or artworks/ and get id in the URL
function trimIllustId(input) {
    /*
    Common type of Pixiv links
    https://www.pixiv.net/en/artworks/61198649
    https://www.pixiv.net/artworks/61198649
    http://www.pixiv.net/member_illust.php?illust_id=61198649
    http://www.pixiv.net/member_illust.php?mode=medium&illust_id=61198649
    61198649
    */
    const match = input.match(/(?:illust_id=|artworks\/)?(\d{5,})/);
    return match ? match[1] : null;
}

function trimIllustCaption(input) {
    let output = "";
    output = input.replace(/<br\s*\/?>/gi, "\n"); // Replace "<br />" with "\n", parse_mode: HTML does not support <br />
    output = output.replace(/\s*(target|rel)=['"][^'"]*['"]/gi, "") // Remove "target='_blank'" and "rel='noopener noreferrer'" if exist.
    return output;
}

bot.on("inlineQuery", async (inlineQuery) => {
    const query = inlineQuery.query.trim();
    const illustId = trimIllustId(query);
    if (!illustId) {
        return inlineQuery.answerQuery([]);
    }
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
    .image_urls.large --> use as thumb
    .meta_single_page.original_image_url --> original picture if only one pic
    .meta_pages[] --> multiple pictures

    Author info:
    .user.id --> user id
    .user.name --> user name
    */
    try {
        const illustOriginalUrl = result.meta_single_page.original_image_url.replace("https://i.pximg.net/", PIXIV_REVERSE_PROXY_URL);
        const illustThumbUrl = result.image_urls.large.replace("https://i.pximg.net/", PIXIV_REVERSE_PROXY_URL);
        const illustPageUrl = `https://www.pixiv.net/artworks/${illustId}`;
        const authorUrl = `https://www.pixiv.net/users/${result.user.id}`;
        const illustCaptionRaw = trimIllustCaption(result.caption);
        const illustCaption = `${result.title} by <a href="${authorUrl}">${result.user.name}</a>\n${illustPageUrl}\n${illustCaptionRaw}`;
        console.log("illustCaption:", illustCaption);

        return inlineQuery.answerQuery([
            {
                type: "photo",
                parse_mode: "HTML",
                id: illustId,
                photo_file_id: illustId,
                photo_width: result.width,
                photo_height: result.height,
                photo_url: illustOriginalUrl,
                thumbnail_url: illustThumbUrl,
                caption: illustCaption
            }
        ]);
    } catch (error) {
        console.error(error);
    }
});

bot.login();