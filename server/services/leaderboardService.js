import mongoose from "mongoose";
import userModel from "../models/user.js";
import leaderboardModel from "../models/leaderboard.js";

class LeaderboardService {
  /**
   * เพิ่มคะแนนให้ leaderboard
   * @param {number} userId - ไอดีของผู้ใช้
   * @param {number} leaderboardId - ไอดีของ leaderboard
   * @param {int} score - คะแนนใน leaderboard ที่จะเพิ่ม
   * @returns {Promise<object>} - คืนค่า user ที่อัปเดตแล้ว
   * @throws {LeaderboardException} - หาก userId หรือ leaderboardId ไม่ถูกต้อง
   */
  static async addScore(userId, leaderboardId, score) {
    const user = await userModel.findOne({ id: userId }).lean();

    if (!user) throw new LeaderboardException("User not found", 404);

    const leaderboard = await leaderboardModel.findOne({ id: leaderboardId });

    if (!leaderboard) throw new LeaderboardException("Leaderboard not found", 404);

    const existingEntryIndex = leaderboard.userScores.findIndex(
      (entry) => entry.userId === userId
    );

    if (existingEntryIndex !== -1) {
      // ถ้ามีอยู่แล้ว: อัปเดตคะแนนถ้าใหม่มากกว่า
      if (score > leaderboard.userScores[existingEntryIndex].score) {
        leaderboard.userScores[existingEntryIndex].score = score;
      }
    } else {
      leaderboard.userScores.push({ userId, username: user.username, score });
    }

    // Sort by score descending (ถ้าต้องการ)
    leaderboard.userScores.sort((a, b) => b.score - a.score);

    await leaderboard.save();

    return leaderboard;
  }
}

class LeaderboardException extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "LeaderboardException";
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export { LeaderboardService, LeaderboardException };
