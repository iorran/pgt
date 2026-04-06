import { env } from '../env.js';
import { ResendEmailProvider } from './resend-provider.js';
import { EmailService } from './email-service.js';

const provider = new ResendEmailProvider(env.RESEND_API_KEY, env.EMAIL_FROM);
export const emailService = new EmailService(provider);
