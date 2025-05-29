import express from "express";
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
import { setupWebsocket } from "./websocket.js";
import createBotClient from "./bot.js";
import { authenticateToken, JWT_SECRET, checkIsJson } from "./middlewares/authenticateToken.js";
import errorHandler from "./middlewares/errorHandler.js";
import worldModel from "./models/world.js";
import { UserService } from "./services/userService.js";
import leaderboardModel from "./models/leaderboard.js";
import adminRouter from "./admin.js";
import { removeHiddenKey, showRequestLog } from "./middlewares/requestEditor.js";
import { InventoryService } from "./services/inventoryService.js";
import fuseModel from "./models/Fuse.js";
import { itemModel } from "./models/item.js";
import WsUserData from "./classes/wsUserData.js";
import { FixedItemId, FixedRewardService, loadAllFixedItem, RewardGroup } from "./services/fixedRewardService.js";
import FixedReward from "./classes/fixedReward.js";
import { OpenAIException } from "./services/openAiService.js";
dotenv.config({ path: "./.env" });

const app = express();
const server = http.createServer(app);
const PORT = process.env.SERVER_PORT || 3000;

connectDB().then(loadAllFixedItem);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));

const fileSizes = new Map();

app.use(compression());

app.use(showRequestLog);
app.use(removeHiddenKey);

app.use(express.json({ limit: "256mb" }));
app.set("trust proxy", true);
app.set("views", path.join(__dirname, "server/views"));
app.set("view engine", "ejs");

app.use("/admin", adminRouter);

app.use("/bs-5", express.static(path.join(__dirname, "server/bs-5"), { fallthrough: true }));

app.use("/uploads", express.static(path.join(__dirname, "server/uploads"), { fallthrough: true }));

app.use('/images', express.static(path.join(__dirname, "server/images"), { fallthrough: true }));

app.use('/build', expressStaticGzip(path.join(__dirname, 'public/Build'), {
  enableBrotli: true,
  fallthrough: true,
  orderPreference: ['br', 'gz'],
  setHeaders: (res, filePath) => {
    // if (filePath.endsWith('.br')) {
    //   res.setHeader('Content-Encoding', 'br');
    // }

    if (filePath.endsWith('.wasm') || filePath.endsWith('.wasm.br')) {
      res.setHeader('Content-Type', 'application/wasm');
    } else if (filePath.endsWith('.js') || filePath.endsWith('.js.br')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.data') || filePath.endsWith('.data.br')) {
      res.setHeader('Content-Type', 'application/octet-stream');
    }

    try {
      if (!fileSizes.has(filePath)) {
        const stat = fs.statSync(filePath);
        fileSizes.set(filePath, stat.size);
      }
      res.setHeader('Content-Length', fileSizes.get(filePath));
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
  const { userId, nickname, username, email } = req.body;

  const user = await userModel.findOne({ id: userId }).lean();

  if (!user) {
    try {
      await userModel.create({
        id: userId,
        nickname,
        username
      });
    } catch (error) {
      console.error("User creation failed:", error);
      if (error.code !== 11000) {
        return res.status(500).json({ message: "Database error", error });
      }
    }
  }

  const refreshToken = jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: "30d",
  });
  const accessToken = jwt.sign(
    { userId, refreshToken: refreshToken },
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
    { id: userId },
    {
      $set: {
        refreshToken: refreshToken,
        nickname: nickname,
        username: username,
        email: email
      }
    },
  );

  return res.status(200).json({
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
    const nowUser = await userModel.findOne({ id: user.userId }).lean();
    if (!nowUser) return res.status(404).json({ error: "User not found" });

    if (nowUser.refreshToken === refreshToken) {
      const accessToken = jwt.sign(
        { id: nowUser.userId, refreshToken: refreshToken },
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

app.get("/profile", authenticateToken, async (req, res) => {
  const user = await userModel
    .findOne({ id: req.userId })
    .populate([
      "stats.equipment.weapon1",
      "stats.equipment.weapon2",
      "stats.equipment.weapon3",
      "stats.equipment.core",
      "stats.inventory.item",
      "stats.clearedStages.rewardCollected.item",
      "stats.approvingStages"
    ])
    .lean();

  if (!user) return res.status(400).json({ message: "User not found" });

  res.status(200).json({
    id: user.id,
    nickname: user.nickname,
    username: user.username,
    friends: user.friends,
    stats: user.stats,
  });
});

app.get("/users/:userId", async (req, res) => {
  const { userId } = req.params;

  const user = await userModel
    .findOne({ id: userId })
    .populate([
      "stats.equipment.weapon1",
      "stats.equipment.weapon2",
      "stats.equipment.weapon3",
      "stats.equipment.core",
      "stats.inventory.item",
      "stats.clearedStages.rewardCollected.item",
      "stats.approvingStages"
    ])
    .lean();

  if (!user) return res.status(400).json({ message: "User not found" });

  res.status(200).json({
    id: user.id,
    nickname: user.nickname,
    username: user.username,
    friends: user.friends,
    stats: user.stats,
  });
});

app.get("/leaderboard/:leaderboardId", async (req, res) => {
  const { leaderboardId } = req.params;

  const leaderboard = await leaderboardModel.findOne({ id: leaderboardId }).lean();

  if (!leaderboard) return res.status(404).json({ message: "Leaderboard not found" })

  return res.status(200).json({
    name: leaderboard.name,
    userScores: leaderboard.userScores
  });
});

app.get("/getWorlds", authenticateToken, async (req, res) => {
  const user = await userModel.findOne({ id: req.userId }).lean();

  if (!user) return res.status(400).json({ message: "User not found" });

  const worlds = await worldModel.find({
    $or: [
      { whitelists: { $in: [req.userId] } },
      { whitelists: { $size: 0 } }
    ]
  }).lean();

  res.status(200).json({
    worlds: worlds.map(world => {
      return {
        id: world.id,
        name: world.worldName
      };
    })
  });
});

app.get("/getStages/:worldId", authenticateToken, async (req, res) => {
  const { worldId } = req.params;

  const world = await worldModel
    .findOne({ id: worldId })
    .populate("stages")
    .lean();

  if (!world) return res.status(400).json({ message: "World not found" });

  const user = await userModel.findOne({ id: req.userId }).lean();

  if (!user) return res.status(400).json({ message: "User not found" });

  const clearedStages = user.stats.clearedStages;

  res.status(200).json({
    stages: world.stages,
    clearedStages: clearedStages
  });
  // res.status(200).json({
  //   stages: [],
  //   clearedStages: clearedStages
  // });
});

// app.get("/backoffice", async (req, res) => {
//   res.render("backoffice");
// });

// app.get("/approveList", async (req, res) => {
//   const data = await approveModel.find();

//   res.render("approve", { data });
// });

app.get("/rewardCollected/:rewardCollectedId", authenticateToken, checkIsJson, async (req, res) => {
  const { rewardCollectedId } = req.params;
  const userId = req.userId;

  const user = await userModel
    .findOne({ id: userId })
    .populate("stats.clearedStages.reward.item")
    .lean();

  if (!user) return res.status(400).json({ message: "User not found" });

  const rewardCollected = user.stats.clearedStages.find(cs => cs.reward.id == rewardCollectedId);

  res.json({ rewardCollected });
});

app.put("/updateHealth", authenticateToken, checkIsJson, async (req, res) => {
  const { health } = req.body;
  const userId = req.userId;
  
  const user = await userModel.findOne({ id: userId });

  if (!user) return res.status(400).json({ message: "User not found" });

  if (health <= 0) {
    user.stats.level = Math.max(1, user.stats.level - 1);
    user.stats.health = user.stats.maxHealth;
    await user.save();
  } else {
    user.stats.health = health;
    await user.save();
  }

  return res.json({
    health: user.stats.health,
    level: user.stats.level
  });
});

app.post("/sendStage", authenticateToken, checkIsJson, async (req, res) => {
  const { stageId, startTime, endTime, itemUseds, message } = req.body;
  const userId = req.userId;

  try {
    const rewardCollected = await UserService.clearStage(userId, stageId, startTime, endTime, itemUseds, message);
  
    if (rewardCollected?.rewardId) {
      res.json({ success: true, rewardCollected });
    } else {
      res.json({ success: true, rewardCollected: null });
    }
  } catch (err) {
    if (err instanceof OpenAIException) {
      return res.json({ success: false, error: err.message })
    }
    throw err;
  }
});

app.post("/sendApprove", authenticateToken, checkIsJson, async (req, res) => {
  const { stageId, startTime, endTime, itemUseds, message } = req.body;
  const userId = req.userId;

  const user = await userModel.findOne({ id: req.userId });

  if (!user) return res.status(400).json({ message: "User not found" });

  try {
    const approve = await approveModel.create({
      nickname: user.nickname,
      userId,
      stageId,
      startTime,
      endTime,
      itemUseds,
      message,
    });

    await userModel.updateOne(
      { id: userId },
      { $push: { "stats.approvingStages": approve._id } }
    );
  } catch (err) {
    console.log(err);
    return res.status(200).json({ error: err });
  }

  res.json({ message: "Successfully" });
});
``
app.put(
  "/equipment/update",
  authenticateToken,
  checkIsJson,
  async (req, res) => {
    const { equipmentData } = req.body;

    if (!equipmentData) return res.status(400).json({ error: "JSON not match" });

    const user = await userModel.findOne({ id: req.userId }).lean();

    if (!user) return res.status(404).json({ error: "User not found" });

    const equipment = user.stats.equipment;

    let removedItems = {};
    let addedItems = {};

    for (const key of Object.keys(equipmentData)) {
      const newItem = await itemModel.findOne({ id: equipmentData[key] }).lean();

      const newItemId = newItem?._id;
      const oldItemId = equipment[key];

      const oldIdStr = oldItemId ? oldItemId.toString() : null;
      const newIdStr = newItemId ? newItemId.toString() : null;

      if (newIdStr !== oldIdStr && newIdStr !== undefined) {
        if (oldIdStr) removedItems[key] = oldIdStr;
        if (newIdStr) addedItems[key] = newIdStr;
      }
    }

    for (const key in addedItems) {
      const item = await itemModel.findById(addedItems[key]).lean();

      if (!item) {
        return res.status(400).json({
          error: `Item ${addedItems[key]} not found`,
        });
      }

      if (key.startsWith("weapon") && item.type !== "VoidItem") {
        return res.status(400).json({
          error: `Item ${addedItems[key]} must be a VoidItem`,
        });
      }

      if (key === "core" && item.type !== "CoreItem") {
        return res.status(400).json({
          error: `Item ${addedItems[key]} must be a CoreItem`,
        });
      }
    }

    let updatedUser = null;

    for (const key in removedItems) {
      await userModel.updateOne(
        { id: req.userId },
        { $set: { [`stats.equipment.${key}`]: null } },
      );

      const item = await itemModel.findById(removedItems[key]).lean();

      updatedUser = await InventoryService.addItem(req.userId, item._id);
    }

    for (const key in addedItems) {
      const addedItem = await itemModel.findById(addedItems[key]).lean();

      if (addedItem) {
        await userModel.updateOne(
          { id: req.userId },
          { $set: { [`stats.equipment.${key}`]: addedItem._id } },
        );

        updatedUser = await InventoryService.removeItem(
          req.userId,
          addedItem._id,
        );
      }
    }

    if (updatedUser === null) {
      updatedUser = await userModel
        .findOne({ id: req.userId })
        .populate([
          "stats.equipment.weapon1",
          "stats.equipment.weapon2",
          "stats.equipment.weapon3",
          "stats.equipment.core",
          "stats.inventory.item"
        ])
        .lean();
    }

    return res.json({
      equipment: updatedUser.stats.equipment,
      inventory: updatedUser.stats.inventory,
    });
  },
);

app.post(
  "/item/fuse",
  authenticateToken,
  checkIsJson,
  async (req, res) => {
    const { item1: itemId1, item2: itemId2 } = req.body;

    if (!itemId1) {
      return res.status(400).json({ error: "Json don't have item1 id" });
    } else if (!itemId2) {
      return res.status(400).json({ error: "Json don't have item2 id" });
    }

    const user = await userModel
      .findOne({ id: req.userId })
      .populate("stats.inventory.item")
      .lean();

    if (!user) return res.status(404).json({ error: "User not found" });

    const inventory = user.stats.inventory;

    const item1 = inventory.find((i) =>
      i.item.id.toString() === itemId1
    );
    const item2 = inventory.find((i) =>
      i.item.id.toString() === itemId2
    );

    if (!item1 || !item2) {
      return res.status(404).json({ error: "Item not found" });
    }

    const fuse = await fuseModel.findOne({
      $or: [
        { item1: itemId1, item2: itemId2 },
        { item1: itemId2, item2: itemId1 },
      ],
    }).lean();

    if (!fuse) {
      return res.status(404).json({ error: "Can't find fuse result" });
    }

    const allRate = fuse.results.map((item) => item.rate).reduce(
      (sum, rate) => sum + rate,
      0,
    );

    if (allRate <= 0) {
      return res.status(404).json({ error: "Can't find item result" });
    }

    let rateRandom = Math.floor(Math.random() * allRate) + 1;
    let itemResultId = null;

    for (const item of fuse.results) {
      rateRandom -= item.rate;
      if (rateRandom <= 0) {
        itemResultId = item.itemId;
        break;
      }
    }

    const itemResult = await itemModel.findOne({ id: itemResultId }).lean();
    if (!itemResult) {
      return res.status(404).json({ error: "Can't find item result" });
    }

    await InventoryService.removeItem(req.userId, item1._id);
    await InventoryService.removeItem(req.userId, item2._id);
    await InventoryService.addItem(req.userId, itemResult._id);

    const updatedUser = await userModel
      .findOne({ id: req.userId })
      .populate("stats.inventory.item")
      .lean();

    return res.json({
      resultItem: itemResult,
      inventory: updatedUser.stats.inventory,
    });
  },
);

app.get("/afk/check", authenticateToken, async (req, res) => {
  const wsUserData = WsUserData.getDataByUserId(req.userId);

  if (wsUserData) {
    const rewardData = await wsUserData.checkReward();

    if (rewardData)
      return res.status(200).json({ rewardData, afkRewardTime: wsUserData.afkRewardTime });
    else
      return res.status(200).json({ message: "Wait", afkRewardTime: wsUserData.afkRewardTime });
  }

  return res.status(404).json({ message: "Can't find user websocket" });
});

app.post("/gacha/roll", authenticateToken, async (req, res) => {
  const user = await userModel.findOne({ id: req.userId }).lean();

  if (!user) return res.status(404).json({ error: "User not found" });

  const item = await FixedReward.getItemObject(FixedItemId.GACHA_TICKET);

  if (!item) return res.status(404).json({ error: "Item not found" });

  await InventoryService.removeItem(req.userId, item._id);
  const data = await FixedRewardService.rollReward(req.userId, RewardGroup.GACHA);

  return res.status(200).json(data);
});

app.get("/gacha/images", authenticateToken, async (req, res) => {
  const imagePaths = await FixedReward.getItemImages(RewardGroup.GACHA);

  return res.status(200).json({ imagePaths });
});

setupWebsocket(adminRouter, server);
await createBotClient(app);

app.use(errorHandler);

server.listen(PORT, () => {
  console.log(`server listening on ${PORT}`);
});
