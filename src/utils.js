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