const subscriptionService = require("../services/subscriptionService");

async function listSubscriptions(req, res) {
  try {
    const { items } = await subscriptionService.listSubscriptions(req.session);

    return res.json({
      success: true,
      items,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to load subscriptions.",
      items: [],
    });
  }
}

async function listSubscriptionEvents(req, res) {
  try {
    const { item, events } = await subscriptionService.listSubscriptionEvents(
      req.session,
      req.params.code
    );

    return res.json({
      success: true,
      item,
      events,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to load subscription events.",
      item: null,
      events: [],
    });
  }
}

async function updateSubscription(req, res) {
  try {
    if (typeof req.body?.subscribed !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "subscribed must be a boolean.",
      });
    }

    const { item } = await subscriptionService.updateSubscription(req.session, {
      code: req.params.code,
      subscribed: req.body.subscribed,
    });

    return res.json({
      success: true,
      message: req.body.subscribed
        ? "Subscription enabled."
        : "Subscription disabled.",
      item,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to update the subscription.",
    });
  }
}

async function updateSubscriptionEventPreferences(req, res) {
  try {
    if (!Array.isArray(req.body?.excludedExternalEventIds)) {
      return res.status(400).json({
        success: false,
        message: "excludedExternalEventIds must be an array.",
      });
    }

    const { item, events } = await subscriptionService.updateSubscriptionEventPreferences(
      req.session,
      {
        code: req.params.code,
        excludedExternalEventIds: req.body.excludedExternalEventIds,
      }
    );

    return res.json({
      success: true,
      message: "Subscription event preferences updated.",
      item,
      events,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to update subscription event preferences.",
      item: null,
      events: [],
    });
  }
}

module.exports = {
  listSubscriptionEvents,
  listSubscriptions,
  updateSubscription,
  updateSubscriptionEventPreferences,
};
