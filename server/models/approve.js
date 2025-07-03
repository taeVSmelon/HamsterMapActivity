import mongoose from "mongoose";

const approveSchema = new mongoose.Schema({
    nickname: { type: String, required: true},
    userId : { type: Number, required: true },
    stageName: { type: String, required: true },
    stageId: { type: Number, required: true },
    startTime: { type: Number, required: true },
    endTime: { type: Number, required: true },
    // itemUseds: { type: [String], default: [] },
    message: { type: String, default: null }
});

const approveModel = mongoose.model("Approve", approveSchema, "Approve");

export default approveModel;
