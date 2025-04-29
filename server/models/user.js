import mongoose from "mongoose";
import mongooseSequence from "mongoose-sequence";
const AutoIncrement = mongooseSequence(mongoose);
//const 
const stageSchema = new mongoose.Schema({
    type: { type: String, required: true },
    stageId: { type: String, required: true },
    rewardId: { type: Number, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    itemUseds: { type: [String], default: [] },
    code: { type: String, default: null },
});

const clearStage = new mongoose.Schema({
    python: { type: [stageSchema], default: [] },
    unity: { type: [stageSchema], default: [] },
    blender: { type: [stageSchema], default: [] },
    website: { type: [stageSchema], default: [] }
});

const scoreSchema = new mongoose.Schema({
  python: { type: Number, default: 0 },
  unity: { type: Number, default: 0 },
  blender: { type: Number, default: 0 },
  website: { type: Number, default: 0 },
});

const statSchema = new mongoose.Schema({
  level :{ type: Number, default: 1 },
  maxExp : { type: Number, default: 0 },
  exp : { type: Number, default: 0 },
  maxHealth : { type: Number, default: 100 },
  // inventory : { type: [String], default: [] },
  // equipment : { type: [String], default: [] },
  clearedStages: { type: clearStage, default: {} },
});

const dataSchema = new mongoose.Schema({
  id : { type: Number, unique: true},
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true , default : "1234554321"},
  name : { type: String, required: true },
  discordId : {type : String, default : ""},
  friend: { type: [String] , default: []},
  stats: {type: statSchema, default: {} },
  score : { type: scoreSchema, default: {} },
  refreshToken: { type: String, default: null }
});

dataSchema.plugin(AutoIncrement, { inc_field: 'id', start_seq: 1000 });
const dataModel = mongoose.model("UserData", dataSchema, "UserData");

export default dataModel;
