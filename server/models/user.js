import mongoose from "mongoose";
import mongooseSequence from "mongoose-sequence";
const AutoIncrement = mongooseSequence(mongoose);

const rewardCollectedSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      unique: true,
      sparse: true,
      index: true
    },
    exp: { type: Number, default: 0 },
    item: { type: mongoose.Types.ObjectId, ref: "Item", default: null },
    itemCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const clearedStageSchema = new mongoose.Schema(
  {
    stageId: { type: Number, required: true },
    startTime: { type: Number, required: true },
    endTime: { type: Number, required: true },
    itemUseds: { type: [Number], default: [] },
    message: { type: String, default: null },
    rewardCollected: { type: rewardCollectedSchema, default: null }
  },
  { _id: false }
);

const equipmentSchema = new mongoose.Schema(
  {
    weapon1: {
      type: mongoose.Types.ObjectId,
      ref: "VoidItem",
      default: null,
    },
    weapon2: {
      type: mongoose.Types.ObjectId,
      ref: "VoidItem",
      default: null,
    },
    weapon3: {
      type: mongoose.Types.ObjectId,
      ref: "VoidItem",
      default: null,
    },
    core: {
      type: mongoose.Types.ObjectId,
      ref: "CoreItem",
      default: null,
    },
  },
  { _id: false },
);

const inventoryItemSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Types.ObjectId,
      ref: "Item",
      required: true,
    },
    count: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: false },
);

const statSchema = new mongoose.Schema(
  {
    level: { type: Number, default: 1 },
    maxExp: { type: Number, default: 0 },
    exp: { type: Number, default: 0 },
    maxHealth: { type: Number, default: 100 },
    health: { type: Number, default: 100 },
    inventory: {
      type: [inventoryItemSchema],
      default: [],
    },
    equipment: {
      type: equipmentSchema,
      default: {},
    },
    leaderboards: {
      type: [Number],
      default: []
    },
    clearedStages: {
      type: [clearedStageSchema],
      default: []
    },
    approvingStages: [
      {
        type: mongoose.Types.ObjectId,
        ref: "Approve"
      }
    ]
  },
  { _id: false }
);

// const friendSchema = new mongoose.Schema({
//   friendId: { type: Number, unique: true, index: true }
// });

const userSchema = new mongoose.Schema({
  id: { type: Number, unique: true, index: true },
  nickname: { type: String, required: true },
  username: { type: String, required: true },
  email: { type: String, default: null },
  friends: { type: [Number], default: [] },
  stats: { type: statSchema, default: {} },
  refreshToken: { type: String, default: null },
  // discordToken: { type: String, default: null }
});

rewardCollectedSchema.plugin(AutoIncrement, { id: 'reward_collected_id', inc_field: 'id', start_seq: 1000000 });

const userModel = mongoose.model("User", userSchema, "User");

export default userModel;
