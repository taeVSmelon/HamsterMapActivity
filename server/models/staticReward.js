import mongoose from "mongoose";
import AutoIncrement from "../plugins/autoIncrement.js";

const staticRewardSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    rewardId: {
      type: Number,
      required: true
    },
    rewardPosition: {
      x: {
        type: Number,
        required: true,
      },
      y: {
        type: Number,
        required: true,
      }
    },
    canCollectOneTime: {
      type: Boolean,
      default: false
    }
  }
);

staticRewardSchema.plugin(AutoIncrement, { id: 'static_reward_id', inc_field: 'id', start_seq: 1000000 });

const staticRewardModel = mongoose.model("StaticReward", staticRewardSchema, "StaticReward");

export { staticRewardModel };
