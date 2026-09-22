const express = require("express");

const aiController = require("../controllers/aiController");

const router = express.Router();

router.get("/test", aiController.testOpenAI);
router.post("/parse", aiController.parseText);

module.exports = router;
