import express from "express";
import axios from "axios";
import WebSocket from "ws";
import http from "http";
import querystring from "querystring";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import path from 'path';
import connectDB from "./db.js";
import userModel from "./models/user.js";
import approveModel from "./models/approve.js";
import { setupWebsocket, getWebSocketWithUsername } from "./websocket.js";
import { authenticateToken, JWT_SECRET, checkIsJson } from "./middlewares/authenticateToken.js";
import errorHandler from "./middlewares/errorHandler.js";
dotenv.config({ path: "./.env" });

const app = express();
const server = http.createServer(app);
const PORT = process.env.SERVER_PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";
const stateCache = {};

connectDB();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.set("trust proxy", true);
app.set("view engine", "ejs");
app.set('views', path.join(__dirname, './views'));

if (isProduction) {
  const distPath = path.join(__dirname, "../dist");
  app.use(express.static(distPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  app.get("*", (req, res) => {
    res.send("Development mode — index.html is served via Vite.");
  });
}

app.use((req, res, next) => {
  const currentTime = new Date().toISOString();
  const method = req.method;
  const path = req.originalUrl;
  const ip = req.ip || req.socket.remoteAddress;
  console.log(`${currentTime} - ${ip} - ${method} - ${path}`);
  next();
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/discordToken", async (req, res) => {
  const response = await fetch(`https://discord.com/api/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.VITE_DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code: req.body.code,
    }),
  });

  const responseJson = await response.json();

  console.log("responseJson:", responseJson);

  res.send(responseJson);
});

app.post("/loginDiscord", async (req, res) => {
  const { discordId, discordAccessToken, discordRefreshToken } = req.body;
  const user = await userModel.findOne({ discordId });
  // console.log(user);
  if (!user) return res.status(400).json({ message: "User not found" });
  if (user.password !== pass) {
    return res.status(400).json({ message: "Incorrect password" });
  }

  const refreshToken = jwt.sign({ username: user.username, discordAccessToken, discordRefreshToken }, JWT_SECRET, {
    expiresIn: "30d",
  });
  const accessToken = jwt.sign(
    { username: user.username, discordAccessToken, discordRefreshToken, refreshToken: refreshToken },
    JWT_SECRET,
    { expiresIn: "1h" },
  );

  const refreshTokenExpiredTime = new Date();
  refreshTokenExpiredTime.setDate(refreshTokenExpiredTime.getDate() + 1);

  const accessTokenExpiredTime = new Date();
  accessTokenExpiredTime.setHours(accessTokenExpiredTime.getHours() + 1);

  const refreshTokenExpired = Math.floor(
    refreshTokenExpiredTime.getTime() / 1000,
  );
  const accessTokenExpired = Math.floor(
    accessTokenExpiredTime.getTime() / 1000,
  );

  await userModel.updateOne(
    { username: user.username },
    { $set: { refreshToken: refreshToken } },
  );

  res.status(200).json({
    message: "Login successful",
    refreshToken,
    accessToken,
    refreshTokenExpired,
    accessTokenExpired,
  });
});

app.post("/login", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const user = await userModel.findOne({ username });
  // console.log(user);
  if (!user) return res.status(400).json({ message: "User not found" });
  if (user.password !== password) {
    return res.status(400).json({ message: "Incorrect password" });
  }

  const refreshToken = jwt.sign({ username: user.username }, JWT_SECRET, {
    expiresIn: "30d",
  });
  const accessToken = jwt.sign(
    { username: user.username, refreshToken: refreshToken },
    JWT_SECRET,
    { expiresIn: "1h" },
  );

  const refreshTokenExpiredTime = new Date();
  refreshTokenExpiredTime.setDate(refreshTokenExpiredTime.getDate() + 1);

  const accessTokenExpiredTime = new Date();
  accessTokenExpiredTime.setHours(accessTokenExpiredTime.getHours() + 1);

  const refreshTokenExpired = Math.floor(
    refreshTokenExpiredTime.getTime() / 1000,
  );
  const accessTokenExpired = Math.floor(
    accessTokenExpiredTime.getTime() / 1000,
  );

  await userModel.updateOne(
    { username: user.username },
    { $set: { refreshToken: refreshToken } },
  );

  res.status(200).json({
    message: "Login successful",
    refreshToken,
    accessToken,
    refreshTokenExpired,
    accessTokenExpired,
  });
});

app.post("/refreshToken", async (req, res) => {
  const refreshToken = req.header("Authorization");

  if (!refreshToken) {
    return res.status(401).json({ error: "Invalid token" });
  }

  jwt.verify(refreshToken, JWT_SECRET, async (err, user) => {
    if (err) return res.status(403).json({ error: "Token expired" });
    const nowUser = await userModel.findOne({ username: user.username });
    if (!nowUser) return res.status(404).json({ error: "User not found" });

    if (nowUser.refreshToken === refreshToken) {
      const accessToken = jwt.sign(
        { username: nowUser.username, refreshToken: refreshToken },
        JWT_SECRET,
        { expiresIn: "1h" },
      );

      const accessTokenExpiredTime = new Date();
      accessTokenExpiredTime.setHours(accessTokenExpiredTime.getHours() + 1);

      const accessTokenExpired = Math.floor(
        accessTokenExpiredTime.getTime() / 1000,
      );

      return res.json({
        accessToken,
        accessTokenExpired,
      });
    } else {
      return res.status(403).json({ error: "Token expired" });
    }
  });
});

app.get("/loginDiscord", async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;
  if (!code) {
    return res.status(400).json({ message: "Authorization code not provided" });
  }

  try {
    // Step 1: Exchange code for access token
    const tokenResponse = await axios.post(
      "https://discord.com/api/oauth2/token",
      querystring.stringify({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: process.env.REDIRECT_URI,
        scope: "identify email guilds",
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    const { access_token, refresh_token, token_type } = tokenResponse.data;

    if (!access_token) {
      return res.status(400).json({
        message: "Failed to obtain access token",
        error: tokenResponse.data,
      });
    }

    // Step 2: Fetch user info from Discord
    const userResponse = await axios.get("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `${token_type} ${access_token}`,
      },
    });

    const discordUser = userResponse.data;

    if (!discordUser.id) {
      return res.status(400).json({
        message: "Failed to fetch user from Discord",
        error: discordUser,
      });
    }

    const user = await userModel.findOne({ discord_id: discordUser.id });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }
    const token = jwt.sign(
      {
        username: user.username,
        accessToken: access_token,
        refreshToken: refresh_token,
      },
      JWT_SECRET,
      {
        expiresIn: "10h", // มาปรับได้
      },
    );
    stateCache[state] = token;

    return res.status(200).send("Login successful");
  } catch (error) {
    console.error(
      "Error during Discord OAuth:",
      error.response?.data || error.message,
    );
    return res.status(500).json({
      message: "Internal server error",
      error: error.response?.data || error.message,
    });
  }
});

app.get("/authorizeDiscord", async (req, res) => {
  const state = req.query.state;
  if (!state) return res.status(400).json({ message: "State not provided" });
  if (!stateCache[state]) {
    return res.status(400).json({ message: "State not found" });
  }
  res.status(200).json(stateCache[state]);
  return delete stateCache[state];
});

app.get("/getProfile", authenticateToken, async (req, res) => {
  const data = await userModel.findOne({ username: req.username });
  if (!data) return res.status(400).json({ message: "User not found" });
  res.status(200).json(data);
});

app.get("/getUser/:username", async (req, res) => {
  const user = req.params.username;
  const data = await userModel.findOne({ username: user });
  if (!data) return res.status(400).json({ message: "User not found" });
  res.status(200).json(data);
});

app.get("/leaderBoard/:game", async (req, res) => {
  const game = req.params.game;

  // Validate game parameter
  const validGames = ["python", "unity", "blender", "website"];
  if (!validGames.includes(game)) {
    return res.status(400).json({
      message:
        "Invalid game type. Must be one of: python, unity, blender, website",
    });
  }

  try {
    const sortQuery = {};
    sortQuery[`score.${game}`] = -1; // -1 for descending order

    const data = await userModel.find()
      .sort(sortQuery);
    // console.log(data);
    if (!data || data.length === 0) {
      return res.status(404).json({ message: "No leaderboard data found" });
    }
    var leaderboard = data.map((player) => {
      return {
        id: player.id,
        username: player.name,
        score: player.score[game],
      };
    });
    res.status(200).json(leaderboard);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/sendCode", authenticateToken, async (req, res) => {
  const { type, stageId, code, startTime, endTime, itemUseds, game } = req.body;
  const username = req.username;
  const user = await userModel.findOne({ username });
  try {
    const clearedStages = user.stats.clearedStages[game];
    const clearedStage = clearedStages.find((c) => c.stageId == stageId);

    if (!clearedStage) {
      await userModel.findOneAndUpdate({ username }, {
        $push: {
          [`stats.clearedStages.${game}`]: {
            type,
            stageId,
            code,
            startTime,
            endTime,
            itemUseds,
          },
        },
      }, { new: true });
      await userModel.findOneAndUpdate({ username }, {
        $inc: { [`score.${game}`]: 10 },
      }, { new: true });
    }
  } catch (err) {
    console.log(err);
    return res.status(200).json({ error: err });
  }
  res.send("Successfully");
});

app.get("/getStage/:game", authenticateToken, async (req, res) => {
  const game = req.params.game;
  const data = await userModel.findOne({ username: req.username });
  if (!data) return res.status(400).json({ message: "User not found" });
  const clearedStages = data.stats.clearedStages[game].map((stage) => {
    return {
      type: stage.type,
      stageId: stage.stageId,
      code: stage.code,
      itemUseds: stage.itemUseds,
    };
  });
  res.status(200).json(clearedStages);
});

app.get("/backoffice", async (req, res) => {
  res.render("backoffice");
});

app.get("/approveList", async (req, res) => {
  const data = await approveModel.find();
  res.render("approve", { data });
});

app.post("/addScore", async (req, res) => {
  const { username, game, score } = req.body;
  try {
    await userModel.findOneAndUpdate({ username }, {
      $inc: { [`score.${game}`]: score },
    }, { new: true });
    const ws = getWebSocketWithUsername(username);
    if (ws != null && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        e: "N",
        m: `Your ${game} score added ${score} points`,
        c: "#FFC90E",
      }));
      ws.send(JSON.stringify({
        e: "LS",
      }));
    }
  } catch (err) {
    return res.status(200).json({ error: err });
  }
  res.json({ message: "Successfully" });
});

app.post("/generateId", async (req, res) => {
  const { username, name, password } = req.body;
  try {
    const user = new userModel({
      username,
      name,
      password,
    });
    await user.save();
  } catch (err) {
    return res.status(200).json({ error: err });
  }
  res.json({ message: "Successfully" });
});

app.post("/sendApprove", async (req, res) => {
  const {
    username,
    name,
    game,
    type,
    stageId,
    startTime,
    endTime,
    itemUseds,
    code,
  } = req.body;
  try {
    await approveModel.create({
      username,
      name,
      game,
      type,
      stageId,
      startTime,
      endTime,
      itemUseds,
      code,
    });
  } catch (err) {
    console.log(err);
    return res.status(200).json({ error: err });
  }
  res.json({ message: "Successfully" });
});

app.post("/approved", async (req, res) => {
  const { username, game, type, stageId, startTime, endTime, itemUseds, code } =
    req.body;
  try {
    await userModel.findOneAndUpdate({ username }, {
      $push: {
        [`stats.clearedStages.${game}`]: {
          type,
          stageId,
          code,
          startTime,
          endTime,
          itemUseds,
        },
      },
      $inc: { [`score.${game}`]: 20 },
    }, { new: true });
    await approveModel.findOneAndDelete({ username, stageId });
    const ws = getWebSocketWithUsername(username);
    if (ws != null && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        e: "LS",
      }));
    }
  } catch (err) {
    console.error("Error in /approved:", err);
    return res.status(200).json({ error: err });
  }
  return res.json({ message: "Successfully" });
});

app.post("/rejected", async (req, res) => {
  const { username, stageId } = req.body;
  try {
    await approveModel.findOneAndDelete({ username, stageId });
    const ws = getWebSocketWithUsername(username);
    if (ws != null && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        e: "LS",
      }));
    }
  } catch (err) {
    return res.status(200).json({ error: err });
  }
  res.json({ message: "Successfully" });
});

setupWebsocket(app, server);

app.use(errorHandler);

server.listen(PORT, () => {
  console.log(`server listening on ${PORT}`);
});
