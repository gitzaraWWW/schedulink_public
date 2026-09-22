const express = require("express");
const session = require("express-session");
const cors = require("cors");

const authRouter = require("./auth");
const aiRouter = require("./ai");

const app = express();
const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  app.set("trust proxy", 1);
}

app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: isProduction,
    cookie: {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

app.get("/", (req, res) => {
  res.send("Server is running.");
});

app.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Backend server is running normally.",
  });
});

app.use("/auth", authRouter);
app.use("/ai", aiRouter);

module.exports = app;
