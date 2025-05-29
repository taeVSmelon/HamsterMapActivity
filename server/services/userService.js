import mongoose from "mongoose";
import userModel from "../models/user.js";
import rewardModel from "../models/reward.js";
import { itemModel } from "../models/item.js";
import { LeaderboardService } from "./leaderboardService.js";
import { InventoryService } from "./inventoryService.js";
import { codeStageModel, stageModel } from "../models/stage.js";
import { OpenAIService, OpenAIException } from "./openAiService.js";

class UserService {
  /**
   * ให้รางวัลกับผู้ใช้
   * @param {number} userId - ไอดีของผู้ใช้
   * @param {number} rewardId - ไอดีของรางวัล
   * @returns {Promise<object>} - คืนค่า user ที่อัปเดตแล้ว
   * @throws {UserException} - หาก userId หรือ rewardId ไม่ถูกต้อง
   */
  static async getReward(userId, rewardId) {
    let nowUser = await userModel.findOne({ id: userId });
    if (!nowUser) throw new UserException("User not found", 404);

    const reward = await rewardModel.findOne({ id: rewardId }).lean();
    if (!reward) throw new UserException("Reward not found", 404);

    const allRate = reward.itemDrops.map((itemDrop) => itemDrop.rate).reduce(
      (sum, rate) => sum + rate,
      0,
    );

    if (allRate <= 0) {
      return new UserException("Can't find item result");
    }

    let rateRandom = Math.floor(Math.random() * allRate) + 1;

    let item;
    let count;

    for (const itemDrop of reward.itemDrops) {
      rateRandom -= itemDrop.rate;
      if (rateRandom <= 0) {
        count = itemDrop.count;
        item = await itemModel.findOne({ id: itemDrop.itemId });
        nowUser = await InventoryService.addItem(
          userId,
          item._id,
          count,
        );
        break;
      }
    }

    let changedLevel = false;
    let nowLevel = nowUser.stats.level;
    let nowExp = nowUser.stats.exp;

    nowExp += reward.exp;

    while (nowExp > ((1.35 ** (nowLevel - 1)) + 1) * 100) {
      nowExp -= ((1.35 ** (nowLevel - 1)) + 1) * 100;
      nowLevel += 1;
      changedLevel = true;
    }

    if (changedLevel) {
      const updateFields = {};

      updateFields["stats.maxHealth"] = ((nowLevel - 1) * 20) + 100;
      updateFields["stats.health"] = updateFields["stats.maxHealth"];
      updateFields["stats.level"] = nowLevel;
      updateFields["stats.maxExp"] = ((1.35 ** (nowLevel - 1)) + 1) * 100;
      updateFields["stats.exp"] = nowExp;

      nowUser = await userModel.findOneAndUpdate(
        { id: userId },
        {
          $set: updateFields,
        },
        { new: true },
      );
    }

    nowUser = await userModel.findOneAndUpdate(
      { id: userId },
      {
        $inc: { coin: reward.coin }
      },
      { new: true }
    );

    // for (const leaderScore in reward.leaderScores) {
    //   await LeaderboardService.addScore(userId, leaderScore.leaderboardId, leaderScore.score)
    // }

    if (nowUser instanceof userModel) {
      nowUser = (await nowUser.populate([
        "stats.equipment.weapon1",
        "stats.equipment.weapon2",
        "stats.equipment.weapon3",
        "stats.equipment.core",
        "stats.inventory.item",
        "stats.clearedStages.rewardCollected.item"
      ])).toObject();
    }

    return {
      user: nowUser,
      exp: reward.exp,
      coin: reward.coin,
      item,
      count
    };
  }

  /**
   * Clear Stage ของผู้ใช้
   * @param {number} userId - ไอดีของผู้ใช้
   * @param {number} stageId - ไอดีของ stage
   * @param {number} startTime - เวลาเริ่ม stage
   * @param {number} endTime - เวลาจบ stage
   * @param {[number]} itemUseds - itemId ที่ใช้ clear stage
   * @param {string} message - ข้อความที่ส่ง stage
   * @returns {Promise<object>} - คืนค่า user ที่อัปเดตแล้ว
   * @throws {UserException} - หาก userId หรือ stageId ไม่ถูกต้อง
   */
  static async clearStage(userId, stageId, startTime, endTime, itemUseds, message) {
    const user = await userModel.findOne({ id: userId }).lean();
    if (!user) throw new UserException("User not found", 404);

    const stage = await stageModel
      .findOne({ id: stageId })
      .populate("reward")
      .lean();
    if (!stage) throw new UserException("Stage not found", 404);

    if (
      user.stats.clearedStages.find((c) =>
        c.stageId.toString() === stageId.toString()
      )
    ) {
      throw new UserException("The stage has been cleared");
    }

    if (stage.type == "CodeStage") {
      if (stage.realAnswer) {
        await OpenAIService.checkAnswerWithRealAnswer(
          stage.description,
          stage.realAnswer,
          message
        );
      } else {
        await OpenAIService.checkAnswer(
          stage.description,
          message
        );
      }
    }

    let exp = 0, coin = 0, item = null, count = 0;

    if (stage.reward) {
      const result = await UserService.getReward(
        userId,
        stage.reward.id,
      );

      exp = result.exp;
      coin = result.coin;
      item = result.item;
      count = result.count;
    }

    await userModel.updateOne(
      { id: userId },
      {
        $push: {
          "stats.clearedStages": {
            stageId,
            startTime,
            endTime,
            itemUseds,
            message,
            rewardCollected: {
              exp,
              item: item?._id,
              itemCount: count
            }
          },
        }
      }
    );

    return {
      rewardId: stage.rewardId,
      exp,
      coin,
      item,
      count
    };
  }
}

class UserException extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "UserException";
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export { UserService, UserException };
