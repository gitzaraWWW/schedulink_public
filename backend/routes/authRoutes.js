const express = require("express");

const requireLogin = require("../middleware/requireLogin");
const authController = require("../controllers/authController");
const calendarController = require("../controllers/calendarController");
const chatController = require("../controllers/chatController");
const debugController = require("../controllers/debugController");
const invitationController = require("../controllers/invitationController");
const lucidController = require("../controllers/lucidController");
const mentionController = require("../controllers/mentionController");
const scheduleController = require("../controllers/scheduleController");
const sessionController = require("../controllers/sessionController");
const subscriptionController = require("../controllers/subscriptionController");

const router = express.Router();

router.get("/google", authController.redirectToGoogle);
router.get("/google/callback", authController.handleGoogleCallback);

router.get("/me", sessionController.getMe);
router.get("/logout", sessionController.logout);

router.post("/mention-profile", requireLogin, mentionController.saveMentionProfile);
router.get("/mentions/search", requireLogin, mentionController.searchMentions);
router.get("/mentions/team-members", requireLogin, mentionController.getTeamMembers);
router.get("/subscriptions", requireLogin, subscriptionController.listSubscriptions);
router.get(
  "/subscriptions/:code/events",
  requireLogin,
  subscriptionController.listSubscriptionEvents
);
router.patch(
  "/subscriptions/:code",
  requireLogin,
  subscriptionController.updateSubscription
);
router.patch(
  "/subscriptions/:code/event-preferences",
  requireLogin,
  subscriptionController.updateSubscriptionEventPreferences
);

router.get("/my-invitations", requireLogin, invitationController.getMyInvitations);
router.post(
  "/respond-invitation",
  requireLogin,
  invitationController.respondToInvitation
);
router.post(
  "/respond-invitation-legacy",
  requireLogin,
  invitationController.respondToInvitationLegacy
);
router.delete(
  "/invitations/:invitationId",
  requireLogin,
  invitationController.dismissInvitation
);
router.post(
  "/invitations/dismiss",
  requireLogin,
  invitationController.dismissInvitation
);

router.post("/sync-user", requireLogin, debugController.syncUser);
router.post("/sync-calendar", requireLogin, debugController.syncCalendar);
router.post("/sync-event", requireLogin, debugController.syncEvent);
router.post("/sync-participant", requireLogin, debugController.syncParticipant);
router.patch(
  "/participant-status",
  requireLogin,
  debugController.updateParticipantStatus
);
router.post("/sync-invitation", requireLogin, debugController.syncInvitation);
router.patch(
  "/invitation-status",
  requireLogin,
  debugController.updateInvitationStatus
);

router.get("/events", requireLogin, calendarController.getEvents);
router.patch("/events/:eventId", requireLogin, calendarController.updateEvent);
router.delete("/events/:eventId", requireLogin, calendarController.deleteEvent);
router.patch(
  "/google-events/:googleEventId",
  requireLogin,
  calendarController.updateGoogleEvent
);
router.delete(
  "/google-events/:googleEventId",
  requireLogin,
  calendarController.deleteGoogleEvent
);
router.post("/lucid-query", requireLogin, lucidController.query);

router.get("/action-items", requireLogin, scheduleController.getActionItems);
router.get("/chat/conversations", requireLogin, chatController.listConversations);
router.post("/chat/conversations", requireLogin, chatController.createConversation);
router.patch(
  "/chat/conversations/:conversationId",
  requireLogin,
  chatController.updateConversation
);
router.delete(
  "/chat/conversations/:conversationId/permanent",
  requireLogin,
  chatController.permanentlyDeleteConversation
);
router.delete(
  "/chat/conversations/:conversationId",
  requireLogin,
  chatController.deleteConversation
);
router.get(
  "/chat/conversations/:conversationId/messages",
  requireLogin,
  chatController.listMessages
);
router.post(
  "/chat/conversations/:conversationId/messages",
  requireLogin,
  chatController.createMessage
);
router.post("/quick-add", requireLogin, scheduleController.quickAdd);
router.post("/quick-add-legacy", requireLogin, scheduleController.quickAddLegacy);
router.post(
  "/change-requests/:requestId/review",
  requireLogin,
  scheduleController.reviewUpdateProposal
);
router.post(
  "/change-request-targets/:targetId/respond",
  requireLogin,
  scheduleController.respondToDeleteRequest
);
router.post(
  "/delete-notifications/read",
  requireLogin,
  scheduleController.markDeleteNotificationsRead
);
router.delete(
  "/delete-notifications/:targetId",
  requireLogin,
  scheduleController.dismissDeleteNotification
);

module.exports = router;
