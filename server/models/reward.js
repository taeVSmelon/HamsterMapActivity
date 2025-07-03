import mongoose from "mongoose";
import AutoIncrement from "../plugins/autoIncrement.js";

const rewardSchema = new mongoose.Schema(
  {
    id: { type: Number, unique: true, index: true },
    exp: {
      type: Number,
      default: 0,
    },
    coin: {
      type: Number,
      default: 0,
    },
    itemDrops: [
      {
        _id: false,
        itemId: {
          type: Number,
          required: true
        },
        rate: {
          type: Number,
          required: true,
        },
        count: {
          type: Number,
          default: 1,
        },
      },
    ],
    // leaderScores: [
    //   {
    //     _id: false,
    //     leaderboardId: {
    //       type: Number,
    //       required: true
    //     },
    //     score: {
    //       type: Number,
    //       required: true
    //     }
    //   }
    // ]
  }, { timestamps: true }
);

rewardSchema.plugin(AutoIncrement, { id: 'reward_id', inc_field: 'id', start_seq: 1000000 });

const rewardModel = mongoose.model("Reward", rewardSchema, "Reward");

export default rewardModel;
