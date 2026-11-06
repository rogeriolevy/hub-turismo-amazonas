import type { DatabaseExecutor } from "../db/index.ts";
import { sendBookingEmail } from "./booking-email.ts";
import {
  processNextBookingEmail as processNextBookingEmailDelivery,
  type BookingEmailDeliveryResult,
  type BookingEmailSender,
} from "./booking-email-delivery-service.ts";

export {
  bookingEmailNotificationsEnabled,
  bookingEmailOutboxSummary,
  enqueueBookingEmailNotification,
  retryFailedBookingEmails,
} from "./booking-email-queue-service.ts";

export type { BookingEmailDeliveryResult, BookingEmailSender };

export function processNextBookingEmail(
  db: DatabaseExecutor,
  send: BookingEmailSender = sendBookingEmail,
  now = new Date(),
): Promise<BookingEmailDeliveryResult> {
  return processNextBookingEmailDelivery(db, send, now);
}
