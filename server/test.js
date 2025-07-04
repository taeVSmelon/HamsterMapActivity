// import mongoose from "mongoose";
// import connectDB from "./db.js";
// import { itemModel, itemRanks } from "./models/item.js";
// import userModel from "./models/user.js";

// connectDB().then(async () => {
//     // const users = await userModel.find().populate("stats.inventory.item").lean();

//     // for (const user of users) {
//     //     if (user.nickname.toLowerCase().includes("pxp")) {
//     //         console.log(`${user.nickname}: ${user.stats.inventory.find(item => item.fixedItemId == "HamsterCoinFragment")?.count ?? 0}`);
//     //     }
//     // }

//     const user = await userModel.findOne({ id: 1382608609237794836 }).lean();

//     console.log(user);
// });

const a = new Set();

a.add({
  item: "A"
});

console.log(a);