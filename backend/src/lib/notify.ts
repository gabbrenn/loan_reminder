import { Notify } from "@afrisinc/notify-sdk"
import axios from 'axios';
const apiKeys = process.env.NOTIFY_KEY;
const notify = new Notify({
    apiKey: apiKeys as any
})

const { NOTIFY_API_URL, NOTIFY_KEY } = process.env;

export const sendEmail = async (
    channel: string,
    email: string,
    templateId: string,
    payload: Record<string, any>
): Promise<any> => {
    const response = await axios.post(
        NOTIFY_API_URL as string,
        { channel, recipient: email, templateId, payload },
        {
            headers: {
                Authorization: `Bearer ${NOTIFY_KEY}`,
                'Content-Type': 'application/json',
            },
        }
    );

    console.log('Notify API response:', response.status, response.data);
    return response.data;
};
export default notify