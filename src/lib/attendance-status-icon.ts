import {
  CalendarOff,
  CheckCircle2,
  Clock,
  Clock3,
  HelpCircle,
  Home as HomeIcon,
  PartyPopper,
  XCircle,
  type LucideIcon,
} from "lucide-react";

/** Icon per AttendanceStatus value — shared between the Attendance page and
 * the Reports page's "attendance this month" summary. */
export function iconForAttendanceStatus(status: string): LucideIcon {
  switch (status) {
    case "PRESENT":
      return CheckCircle2;
    case "ABSENT":
      return XCircle;
    case "LATE":
      return Clock;
    case "HALF_DAY":
      return Clock3;
    case "WORK_FROM_HOME":
      return HomeIcon;
    case "HOLIDAY":
      return PartyPopper;
    case "ON_LEAVE":
      return CalendarOff;
    default:
      return HelpCircle;
  }
}
