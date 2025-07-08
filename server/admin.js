import express from "express";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { fileURLToPath } from 'url';
import { checkIsJson } from "./middlewares/authenticateToken.js";
import { broadcast, getWebSocketWithUserId } from "./websocket.js";
import { UserService } from "./services/userService.js";
import approveModel from "./models/approve.js";
import { LeaderboardService } from "./services/leaderboardService.js";
import worldModel from "./models/world.js";
import leaderboardModel from "./models/leaderboard.js";
import fuseModel from "./models/fuse.js";
import { coreItemModel, voidItemModel, itemModel, skillTypes, itemRanks } from "./models/item.js";
import rewardModel from "./models/reward.js";
import { codeStageModel, combatStageModel, enemyNames, stageModel } from "./models/stage.js";
import userModel from "./models/user.js";
import WsUserData from "./classes/wsUserData.js";
import { InventoryService } from "./services/inventoryService.js";
import { staticRewardModel } from "./models/staticReward.js";

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

adminRouter.get("/createStage", async (req, res) => {
  res.render("createStage", { enemyNames });
});

adminRouter.get("/createStaticReward", async (req, res) => {
  res.render("createStaticReward");
});

// adminRouter.get("/updateStage/:stageId", async (req, res) => {
//   const { stageId } = req.params;

//   const stage = await stageModel.find({ id: stageId }).lean();

//   if (!stage) return res.status(404);

//   res.render("updateStage", stage);
// });

adminRouter.get("/createItem", async (req, res) => {
  res.render("createItem", { skillTypes, itemRanks });
});

adminRouter.get("/createItemLevel", async (req, res) => {
  res.render("createItemLevel", { skillTypes, itemRanks });
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
    .populate({
      path: "stages",
      populate: {
        path: "reward"
      }
    })
    .lean();

  res.render("worldList", { data });
});

adminRouter.get("/itemList", async (req, res) => {
  const data = await itemModel.find().lean();

  res.render("itemList", { data });
});


adminRouter.get("/fuseList", async (req, res) => {
  try {
    const fuses = await fuseModel.find().lean();

    // รวม itemId ทั้งหมดที่ต้องใช้: item1, item2, results.itemId
    const allItemIds = fuses.flatMap(f =>
      [f.item1, f.item2, ...f.results.map(r => r.itemId)]
    );
    const uniqueItemIds = [...new Set(allItemIds)];

    // ดึงข้อมูล item ตาม ID
    const items = await itemModel.find({ id: { $in: uniqueItemIds } }).lean();
    const itemMap = Object.fromEntries(items.map(item => [item.id, item.name]));

    // สร้าง object ใหม่ที่มี itemName
    const fusesWithNames = fuses.map(fuse => {
      return {
        ...fuse,
        item1: {
          id: fuse.item1,
          itemName: itemMap[fuse.item1] || "Unknown Item"
        },
        item2: {
          id: fuse.item2,
          itemName: itemMap[fuse.item2] || "Unknown Item"
        },
        results: fuse.results.map(result => ({
          ...result,
          itemName: itemMap[result.itemId] || "Unknown Item"
        }))
      };
    });

    res.render("fuseList", { data: fusesWithNames });
  } catch (err) {
    console.error("Error loading fuse list:", err);
    res.status(500).send("Internal Server Error");
  }
});

adminRouter.get("/rewardList", async (req, res) => {
  try {
    const rewards = await rewardModel.find().lean();

    // ดึง itemId ทั้งหมดที่อยู่ใน itemDrops ของ rewards
    const allItemIds = rewards.flatMap(r => r.itemDrops.map(d => d.itemId));
    const uniqueItemIds = [...new Set(allItemIds)];

    // ดึง item ตาม id เหล่านั้น
    const items = await itemModel.find({ id: { $in: uniqueItemIds } }).lean();

    // สร้าง map ของ itemId -> item
    const itemMap = Object.fromEntries(items.map(item => [item.id, item]));

    // ใส่ itemName ให้แต่ละ itemDrop
    const rewardsWithItemNames = rewards.map(reward => {
      const itemDropsWithName = reward.itemDrops.map(drop => ({
        ...drop,
        itemName: itemMap[drop.itemId]?.name || "Unknown Item"
      }));

      return {
        ...reward,
        itemDrops: itemDropsWithName
      };
    });

    res.render("rewardList", { data: rewardsWithItemNames });
  } catch (err) {
    console.error("Error loading reward list:", err);
    res.status(500).send("Internal server error");
  }
});

adminRouter.get("/staticRewardList", async (req, res) => {
  const data = await staticRewardModel.find().lean();

  res.render("staticRewardList", { data });
});

adminRouter.get("/approveList", async (req, res) => {
  const data = await approveModel.find().lean();

  res.render("approveList", { data });
});

adminRouter.get("/addItem", async (req, res) => {
  res.render("addItem");
});

adminRouter.get("/world/:worldId", async (req, res) => {
  const { worldId } = req.params;

  const world = await worldModel.findOne({ id: worldId }).lean();

  if (!world) return res.status(404).send("World not found");

  res.render("world", { world });
});

adminRouter.get("/userDataList", async (req, res) => {
  const users = await userModel.find().lean();

  res.render("userDataList", { users });
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
      rank,
      canStack,
      canBuy,
      buyPrice,
      canSell,
      sellPrice,
      level,
      health,
      armor,
      voidPrefabName,
      minDamage,
      maxDamage,
      minSpeed,
      maxSpeed,
      chargeTime,
      forcePower,
      lifeTime,
    } = req.body;
    let skills = req.body.skills || [];

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
        rank,
        level,
        canStack: false,
        canBuy,
        buyPrice,
        canSell,
        sellPrice,
        health,
        armor,
      });
    } else if (type === "VoidItem") {
      if (
        minDamage === undefined || maxDamage === undefined ||
        minSpeed === undefined || maxSpeed === undefined ||
        chargeTime === undefined || forcePower === undefined ||
        voidPrefabName === undefined || lifeTime === undefined
      ) {
        return res.status(400).json({
          message: "All properties are required for VoidItem",
        });
      }

      if (skills && Array.isArray(skills)) {
        // ลบ skill ที่ซ้ำกันจาก skillName
        const seen = new Set();
        skills = skills.filter((s) => {
          if (seen.has(s.skillName)) return false;
          seen.add(s.skillName);
          return true;
        });

        // ลบ skill ที่ไม่ valid ออก (invalid = ไม่อยู่ใน enum, ไม่ใช่ตัวเลข, หรือ level < 1)
        skills = skills.filter(
          (s) =>
            skillTypes.includes(s.skillName) &&
            typeof s.level === 'number' &&
            s.level >= 1
        );
      }

      newItem = await voidItemModel.create({
        iconPath,
        name,
        description,
        rank,
        level,
        canStack: false,
        canBuy,
        buyPrice,
        canSell,
        sellPrice,
        voidPrefabName,
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
        rank,
        canStack,
        canBuy,
        buyPrice,
        canSell,
        sellPrice,
      });
    }

    return res.json({
      item: newItem,
    });
  },
);

adminRouter.get("/item/:itemId", async (req, res) => {
  const { itemId } = req.params;

  if (!itemId) return res.status(400).json({ error: "Missing item id" });

  const item = await itemModel.findOne({ id: itemId });

  if (!item) return res.status(404).json({ error: "Item not found" });

  return res.json({ item });
});

adminRouter.put(
  "/item/:itemId/update",
  checkIsJson,
  async (req, res) => {
    const { itemId } = req.params;
    const {
      name,
      description,
      rank,
      canStack,
      canBuy,
      buyPrice,
      canSell,
      sellPrice,
      level,
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
    if (rank !== undefined) item.rank = rank;
    if (canStack !== undefined) item.canStack = canStack;
    if (canBuy !== undefined) item.canBuy = canBuy;
    if (buyPrice !== undefined) item.buyPrice = buyPrice;
    if (canSell !== undefined) item.canSell = canSell;
    if (sellPrice !== undefined) item.sellPrice = sellPrice;

    if (item instanceof CoreItem) {
      if (level !== undefined) item.armor = armor;
      if (health !== undefined) item.health = health;
      if (armor !== undefined) item.armor = armor;
    }

    if (item instanceof VoidItem) {
      if (level !== undefined) item.armor = armor;
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

adminRouter.delete("/item/:itemId/delete", async (req, res) => {
  const { itemId } = req.params;

  // ดึง item ด้วย field `id` (เลขลำดับ), ไม่ใช่ `_id`
  const item = await itemModel.findOneAndDelete({ id: Number(itemId) });
  if (!item) return res.status(404).json({ message: "Item not found" });

  const objectId = item._id; // ✅ ใช้ ObjectId ที่แท้จริงใน field ที่ต้องการ

  await Promise.all([
    // ลบออกจาก clearedStages
    userModel.updateMany(
      { "stats.clearedStages.rewardCollected.item": objectId },
      {
        $set: {
          "stats.clearedStages.$[stage].rewardCollected.item": null,
          "stats.clearedStages.$[stage].rewardCollected.itemCount": 0,
        },
      },
      {
        arrayFilters: [{ "stage.rewardCollected.item": objectId }],
      }
    ),

    // ลบ item จาก inventory
    userModel.updateMany(
      { "stats.inventory.item": objectId },
      { $pull: { "stats.inventory": { item: objectId } } }
    ),

    // ลบจาก fuse table
    fuseModel.deleteMany({
      $or: [
        { item1: Number(itemId) },
        { item2: Number(itemId) },
        { "results.itemId": Number(itemId) },
      ],
    }),

    // ลบจาก reward drop
    rewardModel.updateMany(
      { "itemDrops.itemId": Number(itemId) },
      {
        $pull: {
          itemDrops: { itemId: Number(itemId) },
        },
      }
    ),
  ]);

  res.json({ message: "Item deleted" });
});

adminRouter.post(
  "/staticReward/create",
  checkIsJson,
  async (req, res) => {
    const { rewardId, position: rewardPosition, canCollectOneTime } = req.body;

    const reward = await rewardModel.findOne({ id: rewardId });

    if (!reward) return res.status(400).json({ error: "Reward not found" });

    const newStaticReward = await staticRewardModel.create({
      rewardId,
      rewardPosition,
      canCollectOneTime
    });

    res.json({
      staticReward: newStaticReward,
    });
  },
);

adminRouter.delete(
  "/staticReward/:staticRewardId/delete",
  async (req, res) => {
    const { staticRewardId } = req.params;

    const deleted = await staticRewardModel.findOneAndDelete({ id: Number(staticRewardId) });
    if (!deleted) {
      return res.status(404).json({ error: "Static reward not found" });
    }

    await userModel.updateMany(
      { "stats.collectedStaticRewards": deleted._id },
      { $pull: { "stats.collectedStaticRewards": deleted._id } }
    );

    return res.json({ message: "Static reward deleted" });
  }
);

adminRouter.post(
  "/reward/create",
  checkIsJson,
  async (req, res) => {
    // const { exp, itemDrops, leaderScores } = req.body;
    const { exp, coin, itemDrops } = req.body;

    const newReward = await rewardModel.create({
      exp,
      coin,
      itemDrops,
      // leaderScores
    });

    res.json({
      reward: newReward,
    });
  },
);

adminRouter.put(
  "/reward/:rewardId/update",
  checkIsJson,
  async (req, res) => {
    const { rewardId } = req.params;
    // const { exp, itemDrops, leaderScores } = req.body;
    const { exp, coin, itemDrops } = req.body;

    const updateFields = {};

    if (exp !== undefined) updateFields.exp = exp;
    if (coin !== undefined) updateFields.coin = coin;
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
  const { worldName, whitelists = [] } = req.body;

  if (!worldName) {
    return res.status(400).json({ message: "World name is required" });
  }

  const newWorld = await worldModel.create({
    worldName,
    stages: [],
    whitelists,
  });

  await newWorld.populate("stages")

  res.json({ world: newWorld });
});

adminRouter.patch("/world/:worldId/update", checkIsJson, async (req, res) => {
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
  const { stageType, stageName, description, exampleOutput, realAnswer, npc, haveApprove, rewardId, dungeon } = req.body;

  const world = await worldModel.findOne({ id: worldId });
  if (!world) return res.status(404).json({ message: "World not found" });

  const reward = await rewardModel.findOne({ id: rewardId });

  const discriminatorMap = {
    CodeStage: codeStageModel,
    CombatStage: combatStageModel,
  };

  const childrenStageModel = discriminatorMap[stageType];
  if (!childrenStageModel) {
    return res.status(400).json({ message: "Invalid stage type" });
  }

  let newStage;
  if (childrenStageModel.modelName === codeStageModel.modelName) {
    newStage = await childrenStageModel.create({
      stageName,
      description,
      exampleOutput,
      realAnswer,
      npc,
      haveApprove,
      reward: reward?._id || undefined,
      worldId,
    });
  } else if (childrenStageModel.modelName === combatStageModel.modelName) {
    if (!dungeon) {
      return res.status(400).json({ message: "Dungeon is required for CombatStage" });
    }
    newStage = await childrenStageModel.create({
      stageName,
      dungeon,
      reward: reward?._id || undefined,
      worldId,
    });
  }

  await newStage.save();

  world.stages.push(newStage._id);
  await world.save();

  res.json({ stage: newStage });
});

adminRouter.patch("/world/:worldId/stage/:stageId/update", checkIsJson, async (req, res) => {
  const { stageId } = req.params;
  const { stageName, description, exampleOutput, realAnswer, npc, haveApprove, rewardId, dungeon } = req.body;

  const stage = await stageModel.findOne({ id: stageId });

  if (!stage) return res.status(404).json({ message: "Stage not found" });

  if (stageName !== undefined) stage.stageName = stageName;
  if (rewardId !== undefined) {
    const reward = await rewardModel.findOne({ id: rewardId });
    stage.reward = reward?._id || undefined;
  }
  if (stage.type === "CodeStage") {
    if (description !== undefined) stage.description = description;
    if (exampleOutput !== undefined) stage.exampleOutput = exampleOutput;
    if (realAnswer !== undefined) stage.realAnswer = realAnswer;
    if (npc !== undefined) stage.npc = npc;
    if (haveApprove !== undefined) stage.haveApprove = haveApprove;
  } else if (stage.type === "CombatStage") {
    if (dungeon !== undefined) stage.dungeon = dungeon;
  }

  await stage.save();

  res.json({ stage });
});

adminRouter.delete("/world/:worldId/stage/:stageId/delete", async (req, res) => {
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

adminRouter.post("/upload-image", checkIsJson, async (req, res) => {
  const { base64, defaultScale } = req.body;

  if (!base64) {
    return res.status(400).json({ error: "No image data" });
  }

  // Match: "data:image/png;base64,..."
  const matches = base64.match(/^data:(.+);base64,(.+)$/);
  if (!matches) {
    return res.status(400).json({ error: "Invalid base64 format" });
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const imageBuffer = Buffer.from(base64Data, "base64");

  const ext = mimeType.split("/")[1];
  const filename = `image_${Date.now()}.${ext}`;
  const filePath = path.join(__dirname, "server/uploads", filename);

  try {
    let finalBuffer;

    if (defaultScale === true) {
      // Don't resize
      finalBuffer = imageBuffer;
    } else {
      // Resize the image with max size 256x256, keeping aspect ratio
      finalBuffer = await sharp(imageBuffer)
        .resize(256, 256, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .toFormat(ext === "jpg" ? "jpeg" : ext)
        .toBuffer();
    }

    fs.writeFileSync(filePath, finalBuffer);

    return res.json({
      filename,
      path: `/uploads/${filename}`,
    });
  } catch (error) {
    console.error("Resize error:", error);
    return res.status(500).json({ error: "Image processing failed" });
  }
});

// adminRouter.delete("/remove-image", (req, res) => {
//   const { filename } = req.body;

//   if (!filename) {
//     return res.status(400).json({ error: "Filename is required" });
//   }

//   const filePath = path.join(__dirname, "server/uploads", filename);

//   fs.unlink(filePath, (err) => {
//     if (err) {
//       if (err.code === "ENOENT") {
//         return res.status(404).json({ error: "File not found" });
//       }
//       console.error(err);
//       return res.status(500).json({ error: "Error deleting file" });
//     }

//     res.json({ message: "File deleted successfully" });
//   });
// });

adminRouter.post("/inventory/add", checkIsJson, async (req, res) => {
  const { userId, itemId, count } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User id is required" });
  }
  
  if (!itemId) {
    return res.status(400).json({ error: "Item id is required" });
  }

  if (count === undefined) {
    return res.status(400).json({ error: "Count is required" });
  }

  if (!Number.isInteger(count)) {
    return res.status(400).json({ error: "Count is not integer" });
  }

  const item = await itemModel.findOne({ id: itemId }).lean();

  if (!item) {
    return res.status(400).json({ error: "Item not found" });
  }

  const newUser = await InventoryService.addItem(userId, item._id, count);

  return res.json({
    inventory: newUser.stats.inventory
  })
});

export default adminRouter;
