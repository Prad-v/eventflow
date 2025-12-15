declare global {
    interface Window {
        env: {
            LOGTO_ENDPOINT: string;
            LOGTO_APP_ID: string;
            LOGTO_AUDIENCE: string;
            API_URL?: string;
        };
    }
}

export const logtoConfig = {
    endpoint: window.env?.LOGTO_ENDPOINT || 'https://LOGTO_ENDPOINT_PLACEHOLDER',
    appId: window.env?.LOGTO_APP_ID || 'LOGTO_APP_ID_PLACEHOLDER',
    resources: [window.env?.LOGTO_AUDIENCE || 'https://LOGTO_AUDIENCE_PLACEHOLDER'],
};
