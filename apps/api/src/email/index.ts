import { env } from '../env.js';
import { ResendEmailProvider } from './resend-provider.js';
import { EmailService } from './email-service.js';
import { EmailProvider } from './provider.js';

const noopProvider: EmailProvider = {
  async send() {
    console.warn('Email not sent: RESEND_API_KEY is not configured');
  },
};

const provider = env.RESEND_API_KEY
  ? new ResendEmailProvider(env.RESEND_API_KEY, env.EMAIL_FROM)
  : noopProvider;

export const emailService = new EmailService(provider);
