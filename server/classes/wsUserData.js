import dotenv from "dotenv";
import { FixedRewardService, RewardGroup } from "../services/fixedRewardService.js";
dotenv.config({ path: "./.env" });

const MIN_AFK_TIME = eval(process.env.MIN_AFK_TIME);
const MAX_AFK_TIME = eval(process.env.MAX_AFK_TIME);

const randomAfkTime = () => {
  const afkTime = Math.floor(Math.random() * (MAX_AFK_TIME - MIN_AFK_TIME)) + MIN_AFK_TIME

  return afkTime;
};

class WsUserData {
  static instances = [];

  constructor(ws, userId, loginTime) {
    this.ws = ws;
    this.userId = userId;
    this.afkRewardTime = loginTime + randomAfkTime();
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

  static addNew(ws, userId, loginTime) {
    const wsUserData = new WsUserData(ws, userId, loginTime);

    WsUserData.instances.push(wsUserData);

    return wsUserData;
  }

  static removeByWs(ws) {
    WsUserData.instances = WsUserData.instances.filter(u => u.ws !== ws);
  }
}

export default WsUserData;
