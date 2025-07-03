import dotenv from "dotenv";
import { authenticateToken, checkIsJson } from "./middlewares/authenticateToken.js";
import { itemModel } from "./models/item.js";
import userModel from "./models/user.js";
import { InventoryService } from "./services/inventoryService.js";
dotenv.config({ path: "./.env" });


const RESET_SHOP_ITEM_TIME = eval(process.env.RESET_SHOP_ITEM_TIME);
const shopDatas = new Map();

const getRandomItems = (items, count) => {
    const shuffled = [...items].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};

const setupShop = async (app) => {
    app.get("/shop/list", authenticateToken, async (req, res) => {
        const user = await userModel.findOne({ id: req.userId }).lean();
        if (!user) return res.status(404).json({ error: "User not found" });
        
        const now = Date.now();
    
        let shopData = shopDatas.get(user.id);
        let shopMap;
        let expiredTime;
    
        if (shopData && (now - shopData.expiredTime < RESET_SHOP_ITEM_TIME)) {
            shopMap = shopData.shopMap;
            expiredTime = shopData.expiredTime;
        } else {
            const items = await itemModel.find({ canBuy: true }).lean();
            if (items.length < 4) {
                return res.status(500).json({ error: "Not enough items in shop" });
            }
    
            const randomItems = getRandomItems(items, 4);
            shopMap = new Map();
            for (const item of randomItems) {
                shopMap.set(item.id, item);
            }
            expiredTime = now + RESET_SHOP_ITEM_TIME;
    
            shopDatas.set(user.id, {
                expiredTime: now + RESET_SHOP_ITEM_TIME,
                shopMap: shopMap
            });
        }
    
        return res.json({ expiredTime: expiredTime, shopItems: [...shopMap.values()] });
    });

    app.post("/shop/buy", authenticateToken, checkIsJson, async (req, res) => {
        const { itemId } = req.body;
    
        if (!itemId) return res.status(400).json({ error: "Don't have item id" });
    
        const item = await itemModel.findOne({ id: itemId }).lean();
        if (!item) return res.status(404).json({ error: "Item not found" });
    
        const user = await userModel.findOne({ id: req.userId }).lean();
        if (!user) return res.status(404).json({ error: "User not found" });
    
        const shopData = shopDatas.get(user.id);
        const now = Date.now();
    
        if (!shopData) return res.status(404).json({ error: "Shop not found" });
    
        if (now - shopData.expiredTime >= RESET_SHOP_ITEM_TIME) {
            shopDatas.delete(user.id);
            return res.status(400).json({ error: "Shop has expired. Please refresh." });
        }
    
        const userShopMap = shopData.shopMap;
    
        if (!userShopMap.has(itemId)) {
            return res.status(400).json({ error: "Can't find item in your shop" });
        }
        
        userShopMap.set(itemId, null);
    
        const updatedUser = await InventoryService.addItem(user.id, item._id);
    
        return res.json({ item, user: updatedUser });
    });
};

export default setupShop;