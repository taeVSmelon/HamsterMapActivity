import express from "express";
import WebSocket from "ws";
import http from "http";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';
import compression from 'compression';
import expressStaticGzip from 'express-static-gzip';
import connectDB from "./db.js";
import userModel from "./models/user.js";
import approveModel from "./models/approve.js";
import { setupWebsocket, getWebSocketWithDiscordId } from "./websocket.js";
import createBotClient from "./bot.js";
import { authenticateToken, JWT_SECRET, checkIsJson } from "./middlewares/authenticateToken.js";
import errorHandler from "./middlewares/errorHandler.js";
dotenv.config({ path: "./.env" });

const app = express();
const server = http.createServer(app);
const PORT = process.env.SERVER_PORT || 3000;

connectDB();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));

app.use(compression());
app.use(express.json());
app.set("trust proxy", true);
app.set("views", path.join(__dirname, "server/views"));
app.set("view engine", "ejs");

app.use('/images', express.static(path.join(__dirname, "server/images")));

app.use('/build', expressStaticGzip(path.join(__dirname, 'public/Build'), {
  enableBrotli: true,
  orderPreference: ['br', 'gz'],
  setHeaders: (res, filePath) => {
    res.setHeader('Content-Encoding', 'br');

    if (filePath.endsWith('.wasm.br')) {
      res.setHeader('Content-Type', 'application/wasm');
    } else if (filePath.endsWith('.js.br')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.data.br')) {
      res.setHeader('Content-Type', 'application/octet-stream');
    }

    if (filePath.endsWith('.br')) {
      res.setHeader('Cache-Control', 'public, max-age=360, immutable');
    }

    try {
      const stat = fs.statSync(filePath);
      res.setHeader('Content-Length', stat.size);
    } catch (e) {
      console.warn('Cannot set Content-Length:', e);
    }
  }
}));

app.get('/assetBundle', (req, res) => {
  try {
    const bundleDir = path.join(__dirname, 'public/AssetBundle');
    const files = fs.readdirSync(bundleDir).filter(file => fs.statSync(path.join(bundleDir, file)).isFile());
    if (files.length === 0) {
      return res.status(404).send('No asset bundle files found.');
    }

    const firstFile = files.sort()[0]; // เรียงตามชื่อและเลือกตัวแรก
    const filePath = path.join(bundleDir, firstFile);

    res.setHeader('Content-Type', 'application/octet-stream');
    // res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(filePath);
  } catch (err) {
    console.error('Error loading first bundle:', err);
    res.status(500).send('Server error.');
  }
});

app.get('/sceneBundle', (req, res) => {
  try {
    const bundleDir = path.join(__dirname, 'public/SceneBundle');
    const files = fs.readdirSync(bundleDir).filter(file => fs.statSync(path.join(bundleDir, file)).isFile());
    if (files.length === 0) {
      return res.status(404).send('No scene bundle files found.');
    }

    const firstFile = files.sort()[0]; // เรียงตามชื่อและเลือกตัวแรก
    const filePath = path.join(bundleDir, firstFile);

    res.setHeader('Content-Type', 'application/octet-stream');
    // res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(filePath);
  } catch (err) {
    console.error('Error loading first bundle:', err);
    res.status(500).send('Server error.');
  }
});

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

app.post("/discordToken", checkIsJson, async (req, res) => {
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

  res.send(responseJson);
});

app.post("/loginDiscord", checkIsJson, async (req, res) => {
  const { discordId, nickname, username, email } = req.body;

  let user = await userModel.findOne({ discordId });

  if (!user) {
    user = new userModel({
      discordId: discordId,
      nickname: nickname,
      username: username
    });
    
    try {
      await user.save();
    } catch (error) {
      if (error.code === 11000) {
        // ดักจับกรณีที่ record ถูกสร้างแล้วจาก request อื่นพร้อมกัน
        user = await userModel.findOne({ discordId });
      } else {
        return res.status(500).json({ message: "Database error", error });
      }
    }
  }

  const refreshToken = jwt.sign({ discordId: user.discordId }, JWT_SECRET, {
    expiresIn: "30d",
  });
  const accessToken = jwt.sign(
    { discordId: user.discordId, refreshToken: refreshToken },
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
    { discordId: user.discordId },
    {
      $set: {
        refreshToken: refreshToken,
        nickname: nickname,
        username: username,
        email: email
      }
    },
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
    const nowUser = await userModel.findOne({ discordId: user.discordId });
    if (!nowUser) return res.status(404).json({ error: "User not found" });

    if (nowUser.refreshToken === refreshToken) {
      const accessToken = jwt.sign(
        { discordId: nowUser.discordId, refreshToken: refreshToken },
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

app.get("/getProfile", authenticateToken, async (req, res) => {
  const user = await userModel.findOne({ discordId: req.discordId });

  if (!user) return res.status(400).json({ message: "User not found" });

  res.status(200).json({
    discordId: user.discordId,
    nickname: user.nickname,
    username: user.username,
    friends: user.friends,
    stats: user.stats,
  });
});

app.get("/getUser/:discordId", async (req, res) => {
  const { discordId } = req.params;

  const user = await userModel.findOne({ discordId });

  if (!user) return res.status(400).json({ message: "User not found" });

  res.status(200).json({
    discordId: user.discordId,
    nickname: user.nickname,
    username: user.username,
    friends: user.friends,
    stats: user.stats,
  });
});

app.get("/leaderBoard/:game", async (req, res) => {
  const { game } = req.params;

  const validGames = ["python", "unity", "blender", "website"];
  if (!validGames.includes(game)) {
    return res.status(400).json({
      message:
        "Invalid game type. Must be one of: python, unity, blender, website",
    });
  }

  try {
    const sortQuery = {};
    sortQuery[`score.${game}`] = -1;

    const data = await userModel.find()
      .sort(sortQuery);

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "No leaderboard data found" });
    }

    var leaderboard = data.map((user) => {
      return {
        id: user.id,
        discordId: user.discordId,
        username: user.username,
        score: user.score[game],
      };
    });

    res.status(200).json(leaderboard);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/sendCode", authenticateToken, checkIsJson, async (req, res) => {
  const { type, stageId, code, startTime, endTime, itemUseds, game } = req.body;
  const discordId = req.discordId;

  const user = await userModel.findOne({ discordId });

  try {
    const clearedStages = user.stats.clearedStages[game];
    const clearedStage = clearedStages.find((c) => c.stageId == stageId);

    if (!clearedStage) {
      await userModel.findOneAndUpdate({ discordId }, {
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

      await userModel.findOneAndUpdate({ discordId }, {
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
  const { game } = req.params;

  const data = await userModel.findOne({ discordId: req.discordId });

  if (!data) return res.status(400).json({ message: "User not found" });

  // const clearedStages = data.stats.clearedStages[game].map((stage) => {
  //   return {
  //     type: stage.type,
  //     stageId: stage.stageId,
  //     code: stage.code,
  //     itemUseds: stage.itemUseds,
  //   };
  // });

  const clearedStages = data.stats.clearedStages[game];

  res.status(200).json(clearedStages);
});

app.get("/backoffice", async (req, res) => {
  res.render("backoffice");
});

app.get("/approveList", async (req, res) => {
  const data = await approveModel.find();

  res.render("approve", { data });
});

app.post("/addScore", checkIsJson, async (req, res) => {
  const { discordId, game, score } = req.body;

  try {
    await userModel.findOneAndUpdate({ discordId }, {
      $inc: { [`score.${game}`]: score },
    }, { new: true });

    const ws = getWebSocketWithDiscordId(discordId);

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

app.post("/generateId", checkIsJson, async (req, res) => {
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

app.post("/sendApprove", checkIsJson, async (req, res) => {
  const {
    nickname,
    discordId,
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
      nickname,
      discordId,
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

app.post("/approved", checkIsJson, async (req, res) => {
  const { discordId, game, type, stageId, startTime, endTime, itemUseds, code } = req.body;

  try {
    await userModel.findOneAndUpdate({ discordId }, {
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

    await approveModel.findOneAndDelete({ discordId, stageId });

    const ws = getWebSocketWithDiscordId(discordId);

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

// app.post("/rejected", checkIsJson, async (req, res) => {
//   const { discordId, stageId } = req.body;

//   try {
//     await approveModel.findOneAndDelete({ discordId, stageId });

//     const ws = getWebSocketWithUsername(discordId);

//     if (ws != null && ws.readyState === WebSocket.OPEN) {
//       ws.send(JSON.stringify({
//         e: "LS",
//       }));
//     }
//   } catch (err) {
//     return res.status(200).json({ error: err });
//   }

//   res.json({ message: "Successfully" });
// });

setupWebsocket(app, server);
await createBotClient(app);

app.use(errorHandler);

server.listen(PORT, () => {
  console.log(`server listening on ${PORT}`);
});
