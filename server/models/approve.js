import mongoose from "mongoose";

const dataSchema = new mongoose.Schema({
    nickname: { type: String, required: true},
    discordId : { type: Number, required: true },
    game : { type: String, required: true},
    type: { type: String, required: true },
    stageId: { type: String, required: true },
    // rewardId: { type: String, required: true },
    startTime: { type: Number, required: true },
    endTime: { type: Number, required: true },
    itemUseds: { type: [String], default: [] },
    code: { type: String, default: null }
  
});

const dataModel = mongoose.model("Approve", dataSchema, "Approve");

export default dataModel;
