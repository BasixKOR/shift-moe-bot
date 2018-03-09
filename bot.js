require('dotenv').config();

const Mastodon = require('mastodon-api');
const gm = require('gm').subClass({ imageMagick: true });
const fs = require('fs');
const request = require('request');
const moment = require('moment-timezone');
const path = require('path');

const mastodon = new Mastodon({
    access_token: process.env.ACCESS_TOKEN
});

const modules = [];

function init() {
    fs.readdirSync(path.join(__dirname, 'modules')).forEach((file) => {
        const plugin_module = require(`./modules/${file}/module.js`);
        console.log(`Initialized module ${plugin_module.title}.`);
        modules.push({
            title: plugin_module.title,
            module: plugin_module,
            process: plugin_module.process
        });
    });
}

init();

const stream = mastodon.stream('/api/v1/streaming/user');
let calm = 1;
stream.on('update', (event) => {
    if (!event.data.reblogged) {
        for (let moduleIndex = 0; moduleIndex < modules.length; moduleIndex++) {
            modules[moduleIndex].process(mastodon, event.data);
        }

        console.log(event && event.user.screen_name);
    } else {
        console.log(event && (`${event.user.screen_name} (RT)`));
    }
});
stream.on('error', (error) => {
    if (error.message === 'Status Code: 420') {
        calm++;
    }
    console.error(error);
});

function base64_encode(file) {
    return fs.readFileSync(file, 'base64');
}

function updateHeader() {
    return; // FIXME: 현재 라이브러리의 한계로 API에서 요구하는 PATCH 요청을 보낼 수 없음.
    request('http://free.currencyconverterapi.com/api/v3/convert?q=USD_KRW&compact=y', (usd_error, usd_response, usd_body) => {
        if (!usd_body) return;
        console.log(usd_body);
        const usd_exchangeData = JSON.parse(usd_body);
        if (Object.keys(usd_exchangeData).length < 1) return;

        const usd_data = usd_exchangeData[Object.keys(usd_exchangeData)[0]];
        const usd_rate = usd_data.val;

        request('http://free.currencyconverterapi.com/api/v3/convert?q=JPY_KRW&compact=y', (jpy_error, jpy_response, jpy_body) => {
            if (!jpy_body) return;
            console.log(jpy_body);
            const jpy_exchangeData = JSON.parse(jpy_body);
            if (Object.keys(jpy_exchangeData).length < 1) return;

            const jpy_data = jpy_exchangeData[Object.keys(jpy_exchangeData)[0]];
            const jpy_rate = jpy_data.val * 100;

            request('https://api.korbit.co.kr/v1/ticker?currency_pair=btc_krw', (btc_error, btc_response, btc_body) => {
                if (!btc_body) return;
                console.log(btc_body);
                const btc_exchangeData = JSON.parse(btc_body);
                if (Object.keys(btc_exchangeData).length < 1) return;
                const btc_rate = parseInt(btc_exchangeData.last, 10);

                gm(process.env.HEADER_TEMPLATE_FILE_NAME)
                    .fill('#FFFFFF')
                    .font(process.env.HEADER_TEMPLATE_FONT_NAME)
                    .fontSize(60)
                    .drawText(178, 249, usd_rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 'southeast')
                    .fontSize(36)
                    .drawText(178, 194, jpy_rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 'southeast')
                    .drawText(178, 144, btc_rate.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }), 'southeast')
                    .fill('#000000')
                    .fontSize(18)
                    .drawText(1015, 84, `${moment().tz('Asia/Seoul').format('YYYY-MM-DD, HH:mm')} KST`, 'northwest')
                    .write('temp.png', (err) => {
                        if (err) console.log(err);

                        const data = base64_encode('temp.png');

                        client.post('account/update_profile_banner', { // FIXME: 이후 PATCH 요청이 가능해질 때 수정해야 함.
                            banner: data, width: 1500, height: 421 // vanita5/mastodon-api 이슈 # 6
                        }, (error) => {
                            console.log(error);
                        });
                    });
            });
        });
    });
}

function tryUpdateHeader() {
    updateHeader();
    setTimeout(() => { tryUpdateHeader(); }, 1000 * 60 * 60);
}

tryUpdateHeader();
