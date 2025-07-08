import mongoose from "mongoose";
import connectDB from "./db.js";
// import { itemModel, itemRanks } from "./models/item.js"; // Unused, keeping for context
// import userModel from "./models/user.js"; // Unused, keeping for context
import { stageModel } from "./models/stage.js";
import { OpenAIService, OpenAIException } from "./services/openAIService.js";
import readline from 'readline'; // <--- เพิ่ม import readline เข้ามา

// สร้าง Interface สำหรับรับ input จาก console
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Processes a random stage from the provided stages array and evaluates a given message using OpenAI services.
 * @param {Array<Object>} stages An array of stage documents (already fetched).
 */
const processRandomStageAndEvaluateMessage = async (stages) => {
  if (!stages || stages.length === 0) {
    console.log("No stages provided to processRandomStageAndEvaluateMessage.");
    return;
  }

  const stage = stages[Math.floor(Math.random() * stages.length)];

  console.log("\n--- Processing New Random Stage ---");
  console.log("Selected Stage Description:", stage.description);

  while (true) {
    const message = await askQuestion('กรุณาพิมพ์คำตอบที่ต้องการให้ AI ประเมิน (แล้วกด Enter): ');
    if (!message.trim()) {
        console.log("ไม่ได้รับคำตอบ. สิ้นสุดการทำงาน.");
        return;
    }

    try {
      if (stage.realAnswer) {
        console.log("Checking answer with real answer...");
        await OpenAIService.checkAnswerWithRealAnswer(
          stage.description,
          stage.realAnswer,
          message
        );
      } else {
        console.log("Checking answer without a specific real answer...");
        await OpenAIService.checkAnswer(
          stage.description,
          message
        );
      }
      
      console.log("--- Evaluation Complete for this Stage ---");
  
      break;
    } catch (err) {
      if (err instanceof OpenAIException) {
        console.log("Caught an OpenAI specific exception:");
        console.log(err.message);
      }
    }
  }
};

/**
 * Main function to initiate the process of evaluating random stages multiple times.
 * @param {number} numberOfIterations The number of times to run the evaluation loop.
 */
const runEvaluationsInLoop = async ( numberOfIterations) => {
  if (numberOfIterations <= 0) {
    console.log("Number of iterations must be greater than 0.");
    return;
  }

  console.log(`\nStarting ${numberOfIterations} evaluation cycles.`);

  try {
    await connectDB();
    console.log("Database connection established for evaluation runs.");
  } catch (dbError) {
    console.error("Failed to connect to the database. Exiting:", dbError);
    process.exit(1);
  }

  let stages = [];
  try {
    stages = (await stageModel.find().lean()).filter(s => s.type === "CodeStage");
    if (stages.length === 0) {
      console.log("No 'CodeStage' type stages found in the database. Exiting evaluation.");
      return;
    }
    console.log(`Found ${stages.length} 'CodeStage' type stages.`);
  } catch (findError) {
    console.error("Error fetching stages from database:", findError);
    console.error("Please check your MongoDB connection URI, server status, and network rules.");
    return;
  }

  for (let i = 0; i < numberOfIterations; i++) {
    console.log(`\nIteration ${i + 1}/${numberOfIterations}:`);
    try {
      await processRandomStageAndEvaluateMessage(stages);
    } catch (error) {
      console.error(`Error during iteration ${i + 1}:`, error);
    }
  }
  console.log(`\nFinished ${numberOfIterations} evaluation cycles.`);
};

// --- ส่วนสำหรับรับ input จากผู้ใช้ ---
const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

async function main() {
  const iterations = 10; // กำหนดจำนวนรอบที่ต้องการ

  try {
    await runEvaluationsInLoop(iterations);
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการรับ input หรือระหว่างการทำงาน:", error);
  } finally {
    rl.close(); // ปิด interface readline เมื่อทำงานเสร็จ
  }
}

// เริ่มต้นการทำงาน
main().catch(console.error);