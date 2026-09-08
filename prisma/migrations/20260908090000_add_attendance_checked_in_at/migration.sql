-- Adds a wall-clock check-in time to AttendanceRecord, so a self-service
-- "check in for today" punch (markOwnAttendanceToday) can show when it
-- actually happened, not just which day/status. Null for records HR/a
-- manager marked directly, or created via a correction request.
ALTER TABLE "AttendanceRecord" ADD COLUMN "checkedInAt" TIMESTAMP(3);
