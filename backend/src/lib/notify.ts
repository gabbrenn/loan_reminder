import { Notify } from "@afrisinc/notify-sdk"
import axios from 'axios';
const apiKeys = process.env.NOTIFY_KEY;
const notify = new Notify({
    apiKey: apiKeys as any
})

export const sendEmail = async (
    channel: string,
    email: string,
    payload: Record<string, any>,
    templateId?: string,
): Promise<any> => {
    try {
        const apiUrl = process.env.NOTIFY_API_URL;
        const apiKey = process.env.NOTIFY_KEY;

        const response = await axios.post(
            apiUrl as string,
            { channel: channel, recipient: email, payload, ...(templateId && { templateId }) },
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        console.log('Notify API response:', response.status, response.data);
        return response.data;
    } catch (err: any) {
        console.error('Notify API call failed:', err?.response?.data || err.message);
        return null;
    }
};


export default notify