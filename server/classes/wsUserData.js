import dotenv from "dotenv";
import { FixedRewardService, RewardGroup } from "../services/fixedRewardService.js";
import userModel from "../models/user.js";
dotenv.config({ path: "./.env" });

const MIN_AFK_TIME = eval(process.env.MIN_AFK_TIME);
const MAX_AFK_TIME = eval(process.env.MAX_AFK_TIME);

const randomAfkTime = () => {
  const afkTime = Math.floor(Math.random() * (MAX_AFK_TIME - MIN_AFK_TIME)) + MIN_AFK_TIME

  return afkTime;
};

class WsUserData {
  static instances = [];

  constructor(ws, worldId, userId, stageId, loginTime) {
    this.ws = ws;
    this.worldId = typeof(worldId) === 'string' ? Number.parseInt(worldId) : worldId;
    this.userId = typeof(userId) === 'string' ? Number.parseInt(userId) : userId;
    this.stageId = typeof(stageId) === 'string' ? Number.parseInt(stageId) : stageId;
    this.afkRewardTime = loginTime + randomAfkTime();
  }

  async updatePosition(stageId) {
    stageId = typeof(stageId) === 'string' ? Number.parseInt(stageId) : stageId;
    this.stageId = stageId;

    let username = null;

    try {
      const user = await userModel.findOne({ id: this.userId }, { username: 1 }).lean();
      if (user) {
        username = user.username;
      }
    } catch (err) {
      console.error("Failed to fetch username:", err);
    }

    const userDataInWorld = WsUserData.instances.filter(i => i.worldId == this.worldId && i.userId != this.userId);
    const message = JSON.stringify({
      e: "UP",
      u: this.userId,
      n: username || "Unknown",
      s: stageId
    });

    for (const userData of userDataInWorld) {
      userData.ws.send(message);
    }
  }

  async loadOtherPositions() {
    const userDataInWorld = WsUserData.instances.filter(i => i.worldId == this.worldId && i != this);
    const userIds = userDataInWorld.map(i => i.userId);
    const users = await userModel.find({ id: { $in: userIds } }, { id: 1, username: 1 }).lean();

    const usernameMap = new Map(users.map(u => [u.id.toString(), u.username]));

    for (const userData of userDataInWorld) {
      if (userData.stageId && userData.stageId >= 0) {
        const username = usernameMap.get(userData.userId.toString()) || "Unknown";

        const message = JSON.stringify({
          e: "UP",
          u: userData.userId,
          n: username,
          s: userData.stageId
        });

        this.ws.send(message);
      }
    }
  }

  async checkReward() {
    const timeNow = Date.now();

    const duration = this.afkRewardTime - timeNow;

    if (duration <= 0) {
      this.afkRewardTime = Math.max(timeNow - 5, this.afkRewardTime) + randomAfkTime();

      return await FixedRewardService.rollReward(this.userId, RewardGroup.AFK_REWARD);
    } else {
      return null;
    }
  }

  static getAllWs() {
    return WsUserData.instances.map(user => user.ws);
  }

  static getDataByUserId(userId) {
    return WsUserData.instances.find(user => user.userId == userId);
  }

  static getWsByUserId(userId) {
    return WsUserData.instances.find(user => user.userId == userId)?.ws;
  }

  static addNew(ws, worldId, userId, stageId, loginTime) {
    const wsUserData = new WsUserData(ws, worldId, userId, stageId, loginTime);

    WsUserData.instances.push(wsUserData);

    wsUserData.updatePosition(stageId);

    return wsUserData;
  }

  static removeByWs(ws) {
    WsUserData.instances = WsUserData.instances.filter(u => u.ws !== ws);
  }
}

export default WsUserData;
