import FixedReward from "../classes/fixedReward.js";
import { voidItemModel } from "../models/item.js";
import userModel from "../models/user.js";
import { InventoryService } from "./inventoryService.js";

const RewardGroup = {
    AFK_REWARD: "AfkReward",
    GACHA: "Gacha"
};

const FixedItemId = {
    UPGRADE_STONE_I: "UpgradeStoneI",
    UPGRADE_STONE_II: "UpgradeStoneII",
    UPGRADE_STONE_III: "UpgradeStoneIII",
    GACHA_TICKET_SCRAP: "GachaTicketScrap",
    GACHA_TICKET: "GachaTicket",
    // DISCOUNT_STARWAYS_SCRAP: "DiscountStarwaysScrap",
    DISCOUNT_STARWAYS: "DiscountStarways",
    HAMSTER_COIN_FRAGMENT: "HamsterCoinFragment",
    HAMSTER_BALL: "HamsterBall",
    // GAME_300_BATH: "Game300Bath",
    VOUCHER_300_BATH: "Voucher300Bath",
    SPECIAL_QUEST: "SpecialQuest",
    BOSS_FIGHT_CARD: "BossFightCard",
    HAMS_TALK: "HamsTalk",
    VOID_ITEM: "VoidItem",
};

const loadAllFixedItem = async () => {
    await FixedReward.addNewItem(FixedItemId.UPGRADE_STONE_I, "NPC.png", "Upgrade Stone I");
    await FixedReward.addNewItem(FixedItemId.UPGRADE_STONE_II, "NPC.png", "Upgrade Stone II");
    await FixedReward.addNewItem(FixedItemId.UPGRADE_STONE_III, "NPC.png", "Upgrade Stone III");

    await FixedReward.addNewItem(FixedItemId.GACHA_TICKET, "NPC.png", "Gacha Ticket");
    await FixedReward.addNewItem(FixedItemId.DISCOUNT_STARWAYS, "NPC.png", "ส่วนลด Starways");

    await FixedReward.addNewRandomItem(FixedItemId.HAMSTER_COIN_FRAGMENT, "HamsterCoinFragment.png", "Hamster Coin Fragments", 82, RewardGroup.AFK_REWARD);
    await FixedReward.addNewRandomItem(FixedItemId.VOID_ITEM, "NPC.png", "Free Random Void", 10, RewardGroup.AFK_REWARD);
    await FixedReward.addNewRandomItem(FixedItemId.GACHA_TICKET_SCRAP, "NPC.png", "Gacha Ticket Scrap", 7, RewardGroup.AFK_REWARD);
    // await FixedReward.addNewRandomItem(FixedItemId.GAME_300_BATH, "NPC.png", "Free Game (max 300 bath)", 1, RewardGroup.AFK_REWARD);
    await FixedReward.addNewRandomItem(FixedItemId.HAMSTER_BALL, "HamsterBall.png", "Hamster Balls", 1, RewardGroup.AFK_REWARD);
    // await FixedReward.addNewRandomItem(FixedItemId.DISCOUNT_STARWAYS_SCRAP, "NPC.png", "เศษชิ้นส่วนของส่วนลด Starways", 1, RewardGroup.AFK_REWARD);

    await FixedReward.addNewRandomItem(FixedItemId.HAMSTER_COIN_FRAGMENT, "HamsterCoinFragment.png", "Hamster Coin Fragments", 70, RewardGroup.GACHA);
    await FixedReward.addNewRandomItem(FixedItemId.SPECIAL_QUEST, "NPC.png", "Special Quest", 15, RewardGroup.GACHA);
    await FixedReward.addNewRandomItem(FixedItemId.VOID_ITEM, "NPC.png", "Free Random Void", 9, RewardGroup.GACHA);
    await FixedReward.addNewRandomItem(FixedItemId.HAMSTER_BALL, "HamsterBall.png", "Hamster Balls", 2, RewardGroup.GACHA);
    await FixedReward.addNewRandomItem(FixedItemId.VOUCHER_300_BATH, "NPC.png", "Voucher 100 Bath", 2, RewardGroup.GACHA);
    await FixedReward.addNewRandomItem(FixedItemId.BOSS_FIGHT_CARD, "NPC.png", "บัตรเข้าเล่น Boss Fight", 1, RewardGroup.GACHA);
    await FixedReward.addNewRandomItem(FixedItemId.HAMS_TALK, "NPC.png", "บัตรเข้าฟัง HamsTalk", 1, RewardGroup.GACHA);
};

class FixedRewardService {
    /**
     * สุ่ม reward
     * @param {number} userId - ไอดีของผู้ใช้
     * @param {string} rewardGroup - ไอดีของ reward
     * @returns {Promise<object>} - คืนค่า user ที่อัปเดตแล้ว กับ reward ที่ได้
     * @throws {FixedRewardException} - หาก userId ไม่ถูกต้อง
     */
    static async rollReward(userId, rewardGroup) {
        const user = await userModel.findOne({ id: userId });

        if (!user) throw new FixedRewardService("User not found", 404);

        const fixedReward = FixedReward.roll(rewardGroup);

        if (!fixedReward) throw new FixedRewardService("Reward group not found", 404);

        let updatedUser = null;
        let rewardItem = null;
        let rewardItemCount = 0;

        switch (fixedReward.id) {
            case FixedItemId.HAMSTER_COIN_FRAGMENT:
                const hamsterCoin = await FixedReward.getItemObject(FixedItemId.HAMSTER_COIN_FRAGMENT);

                rewardItem = hamsterCoin;
                
                switch (rewardGroup) {
                    case RewardGroup.AFK_REWARD:
                        rewardItemCount = Math.floor(Math.random() * 2) + 1
                        break
                        
                    case RewardGroup.GACHA:
                        rewardItemCount = Math.floor(Math.random() * 5) + 5
                        break
                }

                updatedUser = await InventoryService.addItem(user.id, hamsterCoin?._id, rewardItemCount);

                break;

            case FixedItemId.VOID_ITEM:
                const voidItems = await voidItemModel.find({
                    rank: { $in: ["G", "F"] }
                }).lean();
                
                if (voidItems.length === 0) break;

                const voidItem = voidItems[Math.floor(Math.random() * voidItems.length)];

                rewardItem = voidItem;
                rewardItemCount = 1;
                updatedUser = await InventoryService.addItem(user.id, voidItem._id);

                break;

            case FixedItemId.GACHA_TICKET_SCRAP:
                const gachaTicketScrap = await FixedReward.getItemObject(FixedItemId.GACHA_TICKET_SCRAP);
                const gachaTicket = await FixedReward.getItemObject(FixedItemId.GACHA_TICKET);

                rewardItem = gachaTicketScrap;
                rewardItemCount = 1;
                await InventoryService.addItem(user.id, gachaTicketScrap?._id);
                updatedUser = await InventoryService.changeItem(user.id, gachaTicketScrap?._id, gachaTicket?._id, 6);

                break;

            case FixedItemId.GAME_300_BATH:
                const game300Bath = await FixedReward.getItemObject(FixedItemId.GAME_300_BATH);

                rewardItem = game300Bath;
                rewardItemCount = 1;
                updatedUser = await InventoryService.addItem(user.id, game300Bath?._id);

                break;

            case FixedItemId.HAMSTER_BALL:
                const hamsterBall = await FixedReward.getItemObject(FixedItemId.HAMSTER_BALL);

                rewardItem = hamsterBall;
                rewardItemCount = Math.floor(Math.random() * 2) + 1;
                updatedUser = await InventoryService.addItem(user.id, hamsterBall?._id, rewardItemCount);

                break;

            case FixedItemId.DISCOUNT_STARWAYS_SCRAP:
                const discountStarwaysScrap = await FixedReward.getItemObject(FixedItemId.DISCOUNT_STARWAYS_SCRAP);
                const discountStarways = await FixedReward.getItemObject(FixedItemId.DISCOUNT_STARWAYS);

                rewardItem = discountStarwaysScrap;
                rewardItemCount = 1;
                await InventoryService.addItem(user.id, discountStarwaysScrap?._id);
                updatedUser = await InventoryService.changeItem(user.id, discountStarwaysScrap?._id, discountStarways?._id, 6);

                break;

            case FixedItemId.SPECIAL_QUEST:
                const specialQuest = await FixedReward.getItemObject(FixedItemId.SPECIAL_QUEST);

                rewardItem = specialQuest;
                rewardItemCount = 1;
                updatedUser = await InventoryService.addItem(user.id, specialQuest?._id);

                break;

            case FixedItemId.VOUCHER_300_BATH:
                const voucher300Bath = await FixedReward.getItemObject(FixedItemId.VOUCHER_300_BATH);

                rewardItem = voucher300Bath;
                rewardItemCount = 1;
                updatedUser = await InventoryService.addItem(user.id, voucher300Bath?._id);

                break;

            case FixedItemId.BOSS_FIGHT_CARD:
                const bossFightCard = await FixedReward.getItemObject(FixedItemId.BOSS_FIGHT_CARD);

                rewardItem = bossFightCard;
                rewardItemCount = 1;
                updatedUser = await InventoryService.addItem(user.id, bossFightCard?._id);

                break;

            case FixedItemId.HAMS_TALK:
                const hamsTalk = await FixedReward.getItemObject(FixedItemId.HAMS_TALK);

                rewardItem = hamsTalk;
                rewardItemCount = 1;
                updatedUser = await InventoryService.addItem(user.id, hamsTalk?._id);

                break;

            default:
                throw new FixedRewardService("Don't have reward", 500);
        }

        return {
            user: updatedUser,
            reward: {
                item: rewardItem,
                itemCount: rewardItemCount
            }
        };
    }
}

class FixedRewardException extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = "FixedRewardException";
        this.statusCode = statusCode;
        Error.captureStackTrace(this, this.constructor);
    }
}

export { FixedRewardService, RewardGroup, FixedItemId, loadAllFixedItem, FixedRewardException };
