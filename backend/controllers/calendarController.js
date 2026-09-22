const calendarService = require("../services/calendarService");
const eventDetailService = require("../services/eventDetailService");

async function getEvents(req, res) {
  try {
    const events = await calendarService.listCalendarEvents(req.session, {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });
    return res.json(events);
  } catch (error) {
    console.error("Calendar event fetch failed:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to load events.",
    });
  }
}

async function updateEvent(req, res) {
  try {
    const payload = await eventDetailService.updateEventDetail(
      req.session,
      req.params.eventId,
      req.body || {}
    );
    return res.json(payload);
  } catch (error) {
    console.error("Calendar event update failed:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "일정 수정에 실패했습니다.",
    });
  }
}

async function updateGoogleEvent(req, res) {
  try {
    const payload = await calendarService.patchExternalCalendarEvent(
      req.session,
      req.params.googleEventId,
      req.body || {}
    );
    return res.json(payload);
  } catch (error) {
    console.error("Google calendar event update failed:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "구글 캘린더 일정 수정에 실패했습니다.",
    });
  }
}

async function deleteEvent(req, res) {
  try {
    const payload = await eventDetailService.deleteEventDetail(
      req.session,
      req.params.eventId
    );
    return res.json(payload);
  } catch (error) {
    console.error("Calendar event delete failed:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "일정 삭제에 실패했습니다.",
    });
  }
}

async function deleteGoogleEvent(req, res) {
  try {
    const payload = await calendarService.deleteExternalCalendarEvent(
      req.session,
      req.params.googleEventId
    );
    return res.json(payload);
  } catch (error) {
    console.error("Google calendar event delete failed:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "구글 캘린더 일정 삭제에 실패했습니다.",
    });
  }
}

module.exports = {
  deleteGoogleEvent,
  deleteEvent,
  getEvents,
  updateGoogleEvent,
  updateEvent,
};
