# Telegram-Bot-Pixiv

An inline Telegram bot written in JavaScript. It is for downloading illustration only.

I use [Telegramsjs](https://github.com/telegramsjs/Telegramsjs) to build this project,

and [probe-image-size](https://github.com/nodeca/probe-image-size) to get width and height of picture


## Installation

1. Clone with Git

```bash
git clone https://github.com/DustRespirator/telegram-bot-pixiv.git

cd telegram-bot-pixiv
```

2. Install dependencies

```bash
npm install
```

## What you need to prepare

TELEGRAM_BOT_TOKEN: a token for your Telegram bot. [@BotFather](https://t.me/BotFather)

PIXIV_REFRESH_TOKEN: a token for getting access token, you will need access token to access pixiv API. There are many methods to get refresh token, for example: [get-pixivpy-token](https://github.com/piglig/pixiv-token)

PIXIV_CLIENT_ID and PIXIV_CLIENT_SECRET: Just have a search.

PIXIV_REVERSE_PROXY_URL: I set a reverse proxy to bypass the anti-hotlinking. Some ideas: [Here](https://github.com/pixiv-cat/pixivcat-cloudflare-workers) or [Here](https://blog.yuki.sh/posts/599ec3ed8eda/#%E5%8F%8D%E5%90%91%E4%BB%A3%E7%90%86)

Put all of them above in .env and that's it.

## Usage

Run on local:

```bash
npm start
```

Or docker...

## TODO List

~~Multiple-pic illustration support.~~ Done.

~~Run in the docker?~~ It works. just DIY.
