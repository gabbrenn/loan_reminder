import axios from 'axios';

export interface SendSMSOptions {
  to: string | string[];
  message: string;
  from?: string;
  enqueue?: boolean;
}

export interface ATRecipientResult {
  statusCode: number;
  number: string;
  status: string;
  cost: string;
  messageId: string;
}

export interface ATSendSMSResponse {
  SMSMessageData: {
    Message: string;
    Recipients: ATRecipientResult[];
  };
}

export class AfricasTalkingUtility {
  private username: string;
  private apiKey: string;
  private senderId?: string;

  constructor(username?: string, apiKey?: string, senderId?: string) {
    this.username = username || process.env.AFRICASTALKING_USERNAME || 'sandbox';
    this.apiKey = apiKey || process.env.AFRICASTALKING_API_KEY || '';
    this.senderId = senderId || process.env.AFRICASTALKING_SENDER_ID || process.env.AFRICASTALKING_FROM;
  }

  private getBaseUrl(): string {
    return this.username.toLowerCase() === 'sandbox'
      ? 'https://api.sandbox.africastalking.com/version1/messaging'
      : 'https://api.africastalking.com/version1/messaging';
  }

  /**
   * Send SMS via Africa's Talking SMS Gateway API
   * @param options SendSMSOptions including recipient phone number(s) and message string
   */
  public async sendSMS(options: SendSMSOptions): Promise<ATSendSMSResponse> {
    if (!this.apiKey) {
      console.warn("[AfricasTalking] Missing API key (AFRICASTALKING_API_KEY environment variable).");
      throw new Error("Africa's Talking API key is not configured.");
    }

    const recipients = Array.isArray(options.to) ? options.to.join(',') : options.to;
    const from = options.from || this.senderId;

    const params = new URLSearchParams();
    params.append('username', this.username);
    params.append('to', recipients);
    params.append('message', options.message);
    
    if (from) {
      params.append('from', from);
    }
    if (options.enqueue) {
      params.append('enqueue', '1');
    }

    try {
      const response = await axios.post<ATSendSMSResponse>(
        this.getBaseUrl(),
        params.toString(),
        {
          headers: {
            'apiKey': this.apiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
        }
      );

      console.log(`[AfricasTalking] SMS request successful for recipient(s): ${recipients}`);
      return response.data;
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const message = err?.message;
      console.error(
        `[AfricasTalking] SMS dispatch failed — HTTP status: ${status} | response: ${JSON.stringify(data)} | error: ${message}`
      );
      throw err;
    }
  }
}

// Export default singleton instance initialized from environment variables
export const africastalking = new AfricasTalkingUtility();

/**
 * Reusable helper function to send an SMS using Africa's Talking
 */
export const sendSMS = async (
  to: string | string[],
  message: string,
  from?: string
): Promise<ATSendSMSResponse> => {
  return africastalking.sendSMS({ to, message, from });
};

export default africastalking;
