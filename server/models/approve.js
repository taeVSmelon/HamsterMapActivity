import mongoose from "mongoose";

const dataSchema = new mongoose.Schema({
    username: { type: String, required: true},
    name : { type: String, required: true },
    game : { type: String, required: true},
    type: { type: String, required: true },
    stageId: { type: String, required: true },
    // rewardId: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    itemUseds: { type: [String], default: [] },
    code: { type: String, default: null }
  
});

const dataModel = mongoose.model("Approve", dataSchema, "Approve");

export default dataModel;
