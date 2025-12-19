
import { UserProfile } from "../types";

/**
 * This service handles interactions with the Telegram WebApp API for payments (Stars).
 */

export const requestStarsPayment = async (profile: UserProfile): Promise<boolean> => {
    // @ts-ignore
    const tg = window.Telegram?.WebApp;

    const TITLE_RU = 'Премиум на Неделю';
    const DESC_RU = 'Полный доступ на 7 дней за 250 Stars';
    const TITLE_EN = 'Weekly Premium';
    const DESC_EN = 'Full access for 7 days for 250 Stars';

    if (!tg) {
        console.warn("Telegram WebApp not available");
        return new Promise(resolve => {
            const confirm = window.confirm(`Simulate Payment: ${DESC_EN}?`);
            setTimeout(() => resolve(confirm), 1000);
        });
    }

    // Check version for showPopup support (introduced in 6.2)
    const isVersionSupported = tg.isVersionAtLeast ? tg.isVersionAtLeast('6.2') : false;

    if (!isVersionSupported) {
        // Fallback for older Telegram versions
        return new Promise(resolve => {
            const confirm = window.confirm(
                profile.language === 'ru' ? DESC_RU : DESC_EN
            );
            resolve(confirm);
        });
    }

    // Modern flow with native popup
    return new Promise((resolve) => {
        tg.showPopup({
            title: profile.language === 'ru' ? TITLE_RU : TITLE_EN,
            message: profile.language === 'ru' ? DESC_RU : DESC_EN,
            buttons: [
                { id: 'pay', type: 'default', text: 'Pay 250 stars' },
                { id: 'cancel', type: 'destructive', text: 'Cancel' }
            ]
        }, (buttonId: string) => {
            if (buttonId === 'pay') {
                if (tg.MainButton) {
                    tg.MainButton.showProgress();
                    setTimeout(() => {
                        tg.MainButton.hideProgress();
                        resolve(true);
                    }, 1500);
                } else {
                    resolve(true);
                }
            } else {
                resolve(false);
            }
        });
    });
};
