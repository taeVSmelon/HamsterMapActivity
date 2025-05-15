import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import { checkIsJson } from "./middlewares/authenticateToken.js";
import { getWebSocketWithUserId } from "./websocket.js";
import { UserService } from "./services/userService.js";
import approveModel from "./models/approve.js";
import { LeaderboardService } from "./services/leaderboardService.js";
import worldModel from "./models/world.js";
import leaderboardModel from "./models/leaderboard.js";
import fuseModel from "./models/Fuse.js";
import { coreItemModel, voidItemModel, itemModel } from "./models/item.js";
import rewardModel from "./models/reward.js";
import { stageModel } from "./models/stage.js";
import userModel from "./models/user.js";
import WsUserData from "./classes/wsUserData.js";

const adminRouter = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename));

const uploadDir = path.join(__dirname, "server/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

adminRouter.get("/", (req, res) => {
  res.send("Welcome to Admin Page");
});

adminRouter.get("/createWorld", async (req, res) => {
  res.render("createWorld");
});

adminRouter.get("/createItem", async (req, res) => {
  res.render("createItem");
});

adminRouter.get("/createFuse", async (req, res) => {
  res.render("createFuse");
});

adminRouter.get("/createReward", async (req, res) => {
  res.render("createReward");
});

adminRouter.get("/worldList", async (req, res) => {
  const data = await worldModel
    .find()
    .populate([
      "stages",
      "stages.reward"
    ])
    .lean();

  res.render("worldList", { data });
});

adminRouter.get("/itemList", async (req, res) => {
  const data = await itemModel.find().lean();

  res.render("itemList", { data });
});

adminRouter.get("/fuseList", async (req, res) => {
  const data = await fuseModel.find().lean();

  res.render("fuseList", { data });
});

adminRouter.get("/rewardList", async (req, res) => {
  const data = await rewardModel.find().lean();

  res.render("rewardList", { data });
});

adminRouter.get("/approveList", async (req, res) => {
  const data = await approveModel.find().lean();

  res.render("approveList", { data });
});

adminRouter.get("/world/:worldId", async (req, res) => {
  const { worldId } = req.params;

  const world = await worldModel.findOne({ id: worldId }).lean();

  if (!world) return res.status(404).send("World not found");

  res.render("world", { world });
});

adminRouter.post("/broadcast", (req, res) => {
  const { message, color } = req.body;
  if (!message) return res.status(400).json({ error: "Missing message" });

  broadcast(WsUserData.getAllWs(), { e: "N", m: message, c: color });
  return res.json({ success: true });
});

adminRouter.post("/addScore", checkIsJson, async (req, res) => {
  const { userId, leaderboardId, score } = req.body;

  try {
    await LeaderboardService.addScore(userId, leaderboardId, score);

    const ws = getWebSocketWithUserId(userId);

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

adminRouter.post("/approved", checkIsJson, async (req, res) => {
  const { userId, stageId, startTime, endTime, itemUseds, message } = req.body;

  await UserService.clearStage(userId, stageId, startTime, endTime, itemUseds, message);

  const approve = await approveModel.findOneAndDelete({ userId, stageId });

  await userModel.updateOne(
    { id: userId },
    { $pull: { "stats.approvingStages": approve._id } }
  );

  const ws = getWebSocketWithUserId(userId);

  if (ws != null && ws.readyState === WebSocket.OPEN) {
    console.log("SEND");
    ws.send(JSON.stringify({
      e: "LS",
    }));
  }

  return res.json({ message: "Successfully" });
});

adminRouter.post(
  "/fuse/create",
  checkIsJson,
  async (req, res) => {
    const { item1, item2, results } = req.body;

    if (!item1) {
      return res.status(400).json({
        message: "Invalid item1 ID",
      });
    }

    if (!item2) {
      return res.status(400).json({
        message: "Invalid item2 ID",
      });
    }

    const existingFuse = await fuseModel.findOne({
      $or: [
        { item1, item2 },
        { item1: item2, item2: item1 },
      ],
    }).lean();

    if (existingFuse) {
      return res.status(400).json({
        message: "Fuse already exists with these items",
      });
    }

    const newFuse = await fuseModel.create({
      item1,
      item2,
      results,
    });

    res.json({
      fuse: newFuse,
    });
  },
);

adminRouter.post(
  "/item/create",
  checkIsJson,
  async (req, res) => {
    const {
      type,
      iconPath,
      name,
      description,
      canStack,
      health,
      armor,
      minDamage,
      maxDamage,
      minSpeed,
      maxSpeed,
      chargeTime,
      forcePower,
      lifeTime,
      skills,
    } = req.body;

    let newItem;

    if (type === "CoreItem") {
      if (health === undefined || armor === undefined) {
        return res.status(400).json({
          message: "Health and Armor are required for CoreItem",
        });
      }

      newItem = await coreItemModel.create({
        iconPath,
        name,
        description,
        health,
        armor,
      });
    } else if (type === "VoidItem") {
      if (
        minDamage === undefined || maxDamage === undefined ||
        minSpeed === undefined || maxSpeed === undefined ||
        chargeTime === undefined || forcePower === undefined ||
        lifeTime === undefined
      ) {
        return res.status(400).json({
          message: "All properties are required for VoidItem",
        });
      }

      newItem = await voidItemModel.create({
        iconPath,
        name,
        description,
        minDamage,
        maxDamage,
        minSpeed,
        maxSpeed,
        chargeTime,
        forcePower,
        lifeTime,
        skills,
      });
    } else {
      newItem = await itemModel.create({
        iconPath,
        name,
        description,
        canStack,
      });
    }

    return res.json({
      item: newItem,
    });
  },
);

adminRouter.put(
  "/item/update/:itemId",
  checkIsJson,
  async (req, res) => {
    const { itemId } = req.params;
    const {
      name,
      description,
      health,
      armor,
      minDamage,
      maxDamage,
      minSpeed,
      maxSpeed,
      chargeTime,
      forcePower,
      lifeTime,
      skills
    } = req.body;

    const item = await itemModel.findOne({ id: itemId });
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    if (name) item.name = name;
    if (description) item.description = description;

    if (item instanceof CoreItem) {
      if (health !== undefined) item.health = health;
      if (armor !== undefined) item.armor = armor;
    }

    if (item instanceof VoidItem) {
      if (minDamage !== undefined) item.minDamage = minDamage;
      if (maxDamage !== undefined) item.maxDamage = maxDamage;
      if (minSpeed !== undefined) item.minSpeed = minSpeed;
      if (maxSpeed !== undefined) item.maxSpeed = maxSpeed;
      if (chargeTime !== undefined) item.chargeTime = chargeTime;
      if (forcePower !== undefined) item.forcePower = forcePower;
      if (lifeTime !== undefined) item.lifeTime = lifeTime;
      if (skills !== undefined) item.skills = skills;
    }

    await item.save();

    return res.json({
      item: item,
    });
  },
);

adminRouter.post(
  "/reward/create",
  checkIsJson,
  async (req, res) => {
    // const { exp, itemDrops, leaderScores } = req.body;
    const { exp, itemDrops } = req.body;

    const newReward = await rewardModel.create({
      exp,
      itemDrops,
      // leaderScores
    });

    res.json({
      reward: newReward,
    });
  },
);

adminRouter.put(
  "/reward/update/:rewardId",
  checkIsJson,
  async (req, res) => {
    const { rewardId } = req.params;
    // const { exp, itemDrops, leaderScores } = req.body;
    const { exp, itemDrops } = req.body;

    const updateFields = {};

    if (exp !== undefined) updateFields.exp = exp;
    if (itemDrops !== undefined) updateFields.itemDrops = itemDrops;
    // if (leaderScores !== undefined) updateFields.leaderScores = itemDrops;

    const updatedReward = await rewardModel.findOneAndUpdate(
      { id: rewardId },
      { $set: updateFields },
      { new: true },
    );

    if (!updatedReward) {
      return res.status(404).json({ error: "Reward not found" });
    }

    res.json({
      reward: updatedReward,
    });
  },
);

adminRouter.post("/leaderboard/create", checkIsJson, async (req, res) => {
  const { leaderboardName } = req.body;

  const existingLeaderboard = await leaderboardModel.findOne({ name: leaderboardName });

  if (existingLeaderboard) return res.status(409).json({ message: "Leaderboard already exists" });

  const leaderboard = await leaderboardModel.create({
    name: leaderboardName
  });

  return res.json({ leaderboard });
});

adminRouter.post("/world/create", checkIsJson, async (req, res) => {
  const { worldName, stages = [], whitelists = [] } = req.body;

  if (!worldName) {
    return res.status(400).json({ message: "World name is required" });
  }

  const createdStages = new Set();

  for (const stageData of stages) {
    const { stageName, description, exampleOutput, npc, haveApprove, rewardId } = stageData;

    const reward = await rewardModel.findOne({ id: rewardId });

    if (stageName && description) {
      const stage = await stageModel.create({
        stageName,
        description,
        exampleOutput,
        npc,
        haveApprove,
        reward: reward?._id || undefined
      });

      createdStages.add(stage._id);
    }
  }

  const validStageIds = Array.from(createdStages).filter((id) => id !== null);

  const newWorld = await worldModel.create({
    worldName,
    stages: validStageIds,
    whitelists,
  });

  res.json({ world: newWorld });
});

adminRouter.patch("/world/update/:worldId", checkIsJson, async (req, res) => {
  const { worldId } = req.params;
  const { worldName, whitelists = [] } = req.body;

  const world = await worldModel.findOne({ id: worldId });

  if (!world) {
    return res.status(404).json({ message: "World not found" });
  }

  if (worldName !== undefined) world.worldName = worldName;
  if (whitelists !== undefined) world.whitelists = whitelists;

  await world.save();

  res.json({ world: world });
});

adminRouter.post("/world/:worldId/stage/create", checkIsJson, async (req, res) => {
  const { worldId } = req.params;
  const { stageName, description, exampleOutput, npc, haveApprove, rewardId } = req.body;

  const world = await worldModel.findOne({ id: worldId });

  if (!world) return res.status(404).json({ message: "World not found" });

  const reward = await rewardModel.findOne({ id: rewardId });

  const newStage = await stageModel.create({
    stageName,
    description,
    exampleOutput,
    npc,
    haveApprove,
    reward: reward?._id || undefined
  });

  await newStage.save();

  world.stages.push(newStage._id);
  await world.save();

  res.status(201).json({ stage: newStage });
});

adminRouter.delete("/world/:worldId/stage/delete/:stageId", async (req, res) => {
  const { worldId, stageId } = req.params;

  const world = await worldModel.findOne({ id: worldId });
  const stage = await stageModel.findOneAndDelete({ id: stageId });

  if (!world) return res.status(404).json({ message: "World not found" });
  if (!stage) return res.status(404).json({ message: "Stage not found" });

  // ⬅️ ลบ ObjectId ออกจาก world.stages
  world.stages = world.stages.filter(stageObjectId => stageObjectId.toString() !== stage._id.toString());
  await world.save();

  res.json({ message: "Stage deleted and removed from world" });
});

adminRouter.patch("/world/:worldId/stage/update/:stageId", checkIsJson, async (req, res) => {
  const { stageId } = req.params;
  const { stageName, description, exampleOutput, npc, haveApprove, rewardId } = req.body;

  const stage = await stageModel.findOne({ id: stageId });

  if (!stage) return res.status(404).json({ message: "Stage not found" });

  if (stageName !== undefined) stage.stageName = stageName;
  if (description !== undefined) stage.description = description;
  if (exampleOutput !== undefined) stage.exampleOutput = exampleOutput;
  if (npc !== undefined) stage.npc = npc;
  if (haveApprove !== undefined) stage.haveApprove = haveApprove;
  if (rewardId !== undefined) {
    const reward = await rewardModel.findOne({ id: rewardId });
    stage.reward = reward?._id || undefined;
  }

  await stage.save();

  res.json({ stage });
});

adminRouter.post("/upload-image", (req, res) => {

  const { base64 } = req.body;

  if (!base64) {
    return res.status(400).json({ error: "No image data" });
  }

  // ตัด prefix เช่น "data:image/png;base64,"
  const matches = base64.match(/^data:(.+);base64,(.+)$/);
  if (!matches) {
    return res.status(400).json({ error: "Invalid base64 format" });
  }

  const mimeType = matches[1];
  const imageBuffer = Buffer.from(matches[2], "base64");

  // ตั้งชื่อไฟล์
  const ext = mimeType.split("/")[1];
  const filename = `image_${Date.now()}.${ext}`;
  const filePath = path.join(__dirname, "server/uploads", filename);

  // เขียนไฟล์ลงดิสก์
  fs.writeFileSync(filePath, imageBuffer);

  return res.json({
    filename,
    path: `/uploads/${filename}`
  });
});

adminRouter.delete("/remove-image", (req, res) => {
  const { filename } = req.body;

  if (!filename) {
    return res.status(400).json({ error: "Filename is required" });
  }

  const filePath = path.join(__dirname, "server/uploads", filename);

  fs.unlink(filePath, (err) => {
    if (err) {
      if (err.code === "ENOENT") {
        return res.status(404).json({ error: "File not found" });
      }
      console.error(err);
      return res.status(500).json({ error: "Error deleting file" });
    }

    res.json({ message: "File deleted successfully" });
  });
});

export default adminRouter;
