// src/connect-wallet-menu.ts

import TelegramBot, { CallbackQuery } from 'node-telegram-bot-api';
import { getWallets, getWalletInfo } from './ton-connect/wallets';
import { bot } from './bot';
import { getConnector } from './ton-connect/connector';
import QRCode from 'qrcode';
import * as fs from 'fs';

export const callbacks = {
    chose_wallet: onChooseWalletClick,
    select_wallet: onWalletClick,
    universal_qr: onOpenUniversalQRClick
};

bot.on('callback_query', query => { // Parse callback data and execute corresponing function
    if (!query.data) {
        return;
    }

    let request: { method: string; data: string };

    try {
        request = JSON.parse(query.data);
    } catch {
        return;
    }

    if (!callbacks[request.method as keyof typeof callbacks]) {
        return;
    }

    callbacks[request.method as keyof typeof callbacks](query, request.data);
});


async function onChooseWalletClick(query: CallbackQuery, _: string): Promise<void> {
    const wallets = await getWallets();

    await bot.editMessageReplyMarkup(
        {
            inline_keyboard: [
                wallets.map(wallet => ({
                    text: wallet.name,
                    callback_data: JSON.stringify({ method: 'select_wallet', data: wallet.appName })
                })),
                [
                    {
                        text: '« Back',
                        callback_data: JSON.stringify({
                            method: 'universal_qr'
                        })
                    }
                ]
            ]
        },
        {
            message_id: query.message!.message_id,
            chat_id: query.message!.chat.id
        }
    );
}

async function onOpenUniversalQRClick(query: CallbackQuery, _: string): Promise<void> {
    const chatId = query.message!.chat.id;
    const wallets = await getWallets();

    const connector = getConnector(chatId);

    connector.onStatusChange(wallet => {
        if (wallet) {
            bot.sendMessage(chatId, `${wallet.device.appName} wallet connected!`);
        }
    });

    const link = connector.connect(wallets);

    await editQR(query.message!, link);

    await bot.editMessageReplyMarkup(
        {
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
        },
        {
            message_id: query.message?.message_id,
            chat_id: query.message?.chat.id
        }
    );
}

async function onWalletClick(query: CallbackQuery, data: string): Promise<void> {
    const chatId = query.message!.chat.id;
    const connector = getConnector(chatId);

    connector.onStatusChange(wallet => {
        if (wallet) {
            bot.sendMessage(chatId, `${wallet.device.appName} wallet connected!`);
        }
    });

    const selectedWallet: any = await getWalletInfo(data);
    if (!selectedWallet) {
        return;
    }

    // @ts-ignore
    const link = connector.connect({
        bridgeUrl: selectedWallet.bridgeUrl,
        universalLink: selectedWallet.universalLink
    });

    await editQR(query.message!, link);

    await bot.editMessageReplyMarkup(
        {
            inline_keyboard: [
                [
                    {
                        text: '« Back',
                        callback_data: JSON.stringify({ method: 'chose_wallet' })
                    },
                    {
                        text: `Open ${selectedWallet.name}`,
                        url: link
                    }
                ]
            ]
        },
        {
            message_id: query.message?.message_id,
            chat_id: chatId
        }
    );
}

async function editQR(message: TelegramBot.Message, link: string): Promise<void> {
    const fileName = 'QR-code-' + Math.round(Math.random() * 10000000000);

    await QRCode.toFile(`./${fileName}`, link);

    await bot.editMessageMedia(
        {
            type: 'photo',
            media: `attach://${fileName}`
        },
        {
            message_id: message?.message_id,
            chat_id: message?.chat.id
        }
    );

    await new Promise(r => fs.rm(`./${fileName}`, r));
}