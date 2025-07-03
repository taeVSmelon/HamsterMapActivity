import mongoose from "mongoose";
import AutoIncrement from "../plugins/autoIncrement.js";

const userScoreSchema = new mongoose.Schema(
    {
        userId: {
            type: Number,
            required: true,
            index: true // เพิ่ม index เพื่อค้นหาเร็ว
        },
        username: {
            type: String,
            required: true,
        },
        score: {
            type: Number,
            default: 0
        }
    },
    { _id: false } // ปิด _id ใน subdocument นี้
);

const leaderboardSchema = new mongoose.Schema({
    id: {
        type: Number,
        unique: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        unique: true // กรณีมี leaderboard หลายอัน เช่น "weekly", "event"
    },
    userScores: {
        type: [userScoreSchema],
        default: []
    }
});

leaderboardSchema.plugin(AutoIncrement, { id: 'leaderboard_id', inc_field: 'id', start_seq: 1000000 });

const leaderboardModel = mongoose.model("Leaderboard", leaderboardSchema, "Leaderboard");

export default leaderboardModel;
