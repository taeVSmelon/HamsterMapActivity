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

// resize-images.js
import sharp from 'sharp';
import fs from 'fs-extra';
import path from 'path';

const inputDir = './server/uploads';       // โฟลเดอร์ภาพต้นฉบับ
const outputDir = './resized';     // โฟลเดอร์สำหรับเก็บภาพที่ย่อแล้ว
const MAX_SIZE = 256;              // ขนาดสูงสุด 256x256

async function resizeImages() {
  await fs.ensureDir(outputDir);
  const files = await fs.readdir(inputDir);

  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, file);

    const { width, height } = await sharp(inputPath).metadata();

    // คำนวณขนาดใหม่ให้ไม่เกิน 256 px
    const scale = Math.min(MAX_SIZE / width, MAX_SIZE / height, 1);
    const newWidth = Math.floor(width * scale);
    const newHeight = Math.floor(height * scale);

    await sharp(inputPath)
      .resize(newWidth, newHeight)
      .toFile(outputPath);

    console.log(`Resized ${file} → ${newWidth}x${newHeight}`);
  }
}

resizeImages().catch(console.error);
