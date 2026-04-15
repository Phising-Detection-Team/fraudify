"use server"

import { Resend } from 'resend';

// NOTE: You must add RESEND_API_KEY to your .env file
// Example: RESEND_API_KEY=re_123456789
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendContactEmail(prevState: unknown, formData: FormData) {
  try {
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const subject = formData.get('subject') as string;
    const message = formData.get('message') as string;

    if (!name || !email || !subject || !message) {
      return { success: false, error: "Please fill in all fields" };
    }

    // You can also use an EmailJS integration or SMTP here if configured differently
    // but Resend gives us standard Next.js native fetch-like sending
    const data = await resend.emails.send({
      from: 'Acme <onboarding@resend.dev>', // Change your verified domain
      to: ['your-team-email@example.com'], // Update where you want to receive these contacts
      subject: `[Contact Form] ${subject} from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
    });

    if (data.error) {
      return { success: false, error: data.error.message };
    }

    return { success: true, message: "Message sent successfully!" };
  } catch (error: unknown) {
    const err = error as Error;
    return { success: false, error: err.message || "An unknown error occurred" };
  }
}
