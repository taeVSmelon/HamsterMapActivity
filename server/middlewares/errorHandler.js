import mongoose from "mongoose";
import { InventoryException } from "../services/inventoryService.js";
import { UserException } from "../services/userService.js";
import { LeaderboardException } from "../services/leaderboardService.js";

const errorHandler = (err, req, res, next) => {
  console.error(err);

  if (err instanceof SyntaxError) {
    return res.status(400).json({ error: "Invalid JSON format" });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ error: err.message });
  }

  if (err instanceof InventoryException || err instanceof UserException || err instanceof LeaderboardException) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  return res.status(500).json({ error: "Internal server error" });
}

export default errorHandler;
