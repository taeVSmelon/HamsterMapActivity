import { OpenAIException, OpenAIService } from './services/openAiService.js';

async function runCheck() {
  try {
    const aiAnswer = await OpenAIService.checkAnswerWithRealAnswer(
      [
        {
          valueType: "text",
          value: `หาภาพนี้จาก Learn ใน Unity Hub ชื่ออะไร`
        }
      ],
      `Create a 2D Roguelike Game`,
      `Create a 2D Roguelike Game เป็นคำตอบสุดท้าย`
    );
    console.log(`Pass: ${aiAnswer}`);
  } catch (err) {
    if (err instanceof OpenAIException) {
      console.log(err.message);
    } else {
      throw err;
    }
  }
}

runCheck();
