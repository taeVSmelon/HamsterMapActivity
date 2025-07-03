import mongoose from "mongoose";
import userModel from "../models/user.js";
import { itemModel } from "../models/item.js";

class InventoryService {
  /**
   * เพิ่มไอเท็มเข้า inventory ของผู้ใช้
   * @param {number} userId - ไอดีของผู้ใช้
   * @param {string} itemId - ไอดีของไอเท็ม (ObjectId)
   * @param {number} count - จำนวนไอเท็ม
   * @returns {Promise<object>} - คืนค่า user ที่อัปเดตแล้ว
   * @throws {InventoryException} - หาก userId หรือ itemId ไม่ถูกต้อง
   */
  static async addItem(userId, itemId, count = 1) {
    const [user, item] = await Promise.all([
      userModel.findOne({ id: userId }).lean(),
      itemModel.findById(itemId).lean(),
    ]);

    if (!user) throw new InventoryException("User not found", 404);
    if (!item) throw new InventoryException("Item not found", 404);

    let updatedUser;

    if (item.canStack) {
      const existingItemIndex = user.stats.inventory.findIndex(
        (i) => i.item.toString() === itemId.toString()
      );

      if (existingItemIndex !== -1) {
        updatedUser = await userModel.findOneAndUpdate(
          { id: userId, [`stats.inventory.${existingItemIndex}.item`]: itemId },
          { $inc: { [`stats.inventory.${existingItemIndex}.count`]: count } },
          { new: true }
        );
      } else {
        updatedUser = await userModel.findOneAndUpdate(
          { id: userId },
          { $push: { "stats.inventory": { item: itemId, count } } },
          { new: true }
        );
      }
    } else {
      updatedUser = await userModel.findOneAndUpdate(
        { id: userId },
        {
          $push: {
            "stats.inventory": {
              $each: Array.from({ length: count }, () => ({ item: itemId }))
            }
          }
        },
        { new: true }
      );
    }

    updatedUser = await updatedUser.populate([
      "stats.equipment.weapon1",
      "stats.equipment.weapon2",
      "stats.equipment.weapon3",
      "stats.equipment.core",
      "stats.inventory.item"
    ]);

    const plainUser = updatedUser.toObject();

    return plainUser;
  }

  /**
   * ลบไอเท็มออกจาก inventory ของผู้ใช้
   * @param {number} userId - ไอดีของผู้ใช้
   * @param {string} itemId - ไอดีของไอเท็ม (ObjectId)
   * @param {number} count - จำนวนไอเท็ม
   * @returns {Promise<object>} - คืนค่า user ที่อัปเดตแล้ว
   * @throws {InventoryException} - หาก userId หรือ itemId ไม่ถูกต้อง
   */
  static async removeItem(userId, itemId, count = 1) {
    const item = await itemModel.findById(itemId);
    if (!item) throw new InventoryException("Item not found", 404);

    const user = await userModel.findOne({ id: userId }).lean();
    if (!user) throw new InventoryException("User not found", 404);

    const existingItem = user.stats.inventory.find(i => i.item.toString() === itemId.toString());

    if (!existingItem) {
      throw new InventoryException("Item not found in inventory", 404);
    }

    let updatedUser;

    if (item.canStack) {
      if (existingItem.count > count) {
        updatedUser = await userModel.findOneAndUpdate(
          { id: userId, "stats.inventory.item": itemId },
          { $inc: { "stats.inventory.$.count": -count } },
          { new: true }
        );
      } else if (existingItem.count == count) {
        updatedUser = await userModel.findOneAndUpdate(
          { id: userId },
          { $pull: { "stats.inventory": { item: itemId } } },
          { new: true }
        );
      } else {
        throw new InventoryException("Item not enough", 400);
      }
    } else {
      const itemsToRemove = user.stats.inventory
        .filter(i => i.item.toString() === itemId.toString())
        .slice(0, count)
        .map(i => i._id);

      if (itemsToRemove.length < count) {
        throw new InventoryException("Not enough items to remove", 404);
      }

      updatedUser = await userModel.findOneAndUpdate(
        { id: userId },
        { $pull: { "stats.inventory": { _id: { $in: itemsToRemove } } } },
        { new: true }
      );
    }

    await updatedUser.populate([
      "stats.equipment.weapon1",
      "stats.equipment.weapon2",
      "stats.equipment.weapon3",
      "stats.equipment.core",
      "stats.inventory.item"
    ]);

    const plainUser = updatedUser.toObject();

    return plainUser;
  }

  /**
   * ลบไอเท็มออกจาก inventory ของผู้ใช้
   * @param {number} userId - ไอดีของผู้ใช้
   * @param {string} itemAId - ไอดีของไอเท็ม A (ObjectId)
   * @param {string} itemBId - ไอดีของไอเท็ม B (ObjectId)
   * @param {number} ratioAtoB - อัตราส่วนระหว่างการเปลี่ยนแปลง
   * @returns {Promise<object>} - คืนค่า user ที่อัปเดตแล้ว
   * @throws {InventoryException} - หาก userId ไม่ถูกต้อง
   */
  static async changeItem(userId, itemAId, itemBId, ratioAtoB) {
    const itemA = await itemModel.findById(itemAId).lean();
    const itemB = await itemModel.findById(itemBId).lean();

    if (!itemA) throw new InventoryException("ItemA not found", 404);
    if (!itemB) throw new InventoryException("ItemB not found", 404);

    const user = await userModel
      .findOne({ id: userId })
      .populate([
        "stats.equipment.weapon1",
        "stats.equipment.weapon2",
        "stats.equipment.weapon3",
        "stats.equipment.core",
        "stats.inventory.item"
      ])
      .lean();
    if (!user) throw new InventoryException("User not found", 404);

    let itemACount = user.stats.inventory.find(i => i.item.toString() === itemAId.toString())?.count ?? 0;
    let itemARemoveCount = 0;
    let itemBAddCount = 0;

    while (itemACount >= ratioAtoB) {
      itemACount -= ratioAtoB;
      itemARemoveCount += ratioAtoB;
      itemBAddCount += 1;
    }

    let updatedUser;

    if (itemARemoveCount >= ratioAtoB && itemBAddCount > 0) {
      await InventoryService.removeItem(userId, itemAId, itemARemoveCount);
      updatedUser = await InventoryService.addItem(userId, itemBId, itemBAddCount);
    }

    return updatedUser;
  }
}

class InventoryException extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "InventoryException";
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export { InventoryService, InventoryException };
