// src/main.ts
import dotenv from 'dotenv';
import {getWalletInfo, getWallets} from './ton-connect/wallets';
import TonConnect from '@tonconnect/sdk';
import { TonConnectStorage } from './ton-connect/storage';
import QRCode from 'qrcode';
import './connect-wallet-menu';


dotenv.config();

import { bot } from './bot';
import {getConnector} from "./ton-connect/connector";

// bot.on('message', msg => {
//     const chatId = msg.chat.id;
//
//     bot.sendMessage(chatId, 'Received your message');
// });

// src/main.ts
bot.onText(/\/connect/, async msg => {
    const chatId = msg.chat.id;
    const wallets = await getWallets();

    const connector = getConnector(chatId);

    connector.onStatusChange(async wallet => {
        if (wallet) {
            const walletName =
                (await getWalletInfo(wallet.device.appName))?.name || wallet.device.appName;
            bot.sendMessage(chatId, `${walletName} wallet connected!`);
        }
    });

    const link = connector.connect(wallets);
    const image = await QRCode.toBuffer(link);

    await bot.sendPhoto(chatId, image, {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: 'Choose a Wallet',
                        callback_data: JSON.stringify({ method: 'chose_wallet' })
                    },
                    {
                        text: 'Open Link',
                        url: `https://ton-connect.github.io/open-tc?connect=${encodeURIComponent(
                            link
                        )}`
                    }
                ]
            ]
        }
    });
});