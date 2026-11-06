export const notificationEvents = [
  "booking.requested",
  "booking.confirmed",
  "booking.declined",
  "booking.cancelled",
  "booking.reminder",
] as const;

export type NotificationEvent = (typeof notificationEvents)[number];

export type UserNotification = {
  id: string;
  event: NotificationEvent;
  company_id: string;
  company_kind: "hotel" | "operator";
  booking_id: string;
  booking_kind: "hotel" | "tour";
  created_at: string;
  read_at: string | null;
};

export type UserNotificationPage = {
  items: UserNotification[];
  unreadCount: number;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
