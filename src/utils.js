// Regex match illust_id= or artworks/ and get id in the URL
export function trimIllustId(input) {
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

// Remove Telegram Bot API parse_mode: HTML unsupported elements
export function trimIllustCaption(input) {
    let output = "";
    output = input.replace(/<br\s*\/?>/gi, "\n"); // Replace "<br />" with "\n", parse_mode: HTML does not support <br />
    output = output.replace(/\s*(target|rel)=['"][^'"]*['"]/gi, "") // Remove "target='_blank'" and "rel='noopener noreferrer'" if exist.
    return output;
}

// Verify if the original picture fit the request of InlineQueryResultPhoto that:
// Photo must be in JPEG format. Photo size must not exceed 5MB
export async function verifyOriginalIllust(input) {
    const response = await fetch(input, { method: 'HEAD' });
    const contentType = response.headers.get("Content-Type");
    const contentLength = parseInt(response.headers.get("Content-Length"), 10);
    // Pixiv only provide .jpg and .png through API, no .gif
    // If it is .jpg and not exceed 5MB return true.
    if (contentType === "image/jpeg" && contentLength <= 5000000) {
        return true;
    } else {
        return false;
    }
}