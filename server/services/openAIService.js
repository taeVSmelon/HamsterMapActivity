import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

const OPEN_AI_ORGANIZATION = process.env.OPEN_AI_ORGANIZATION;
const OPEN_AI_PROJECT = process.env.OPEN_AI_PROJECT;
const OPEN_AI_AUTHORIZATION = process.env.OPEN_AI_AUTHORIZATION;

const url = "https://api.openai.com/v1/responses";
const aiAssistantPrompt = `You are an AI assistant tasked with evaluating student answers to various questions.

**Always follow these rules:**

1. **Determine the question to use:**
   - If any item in the "question" array contains the string "Quest! :", extract and use only the text after "Quest! :" as the true question.
   - Otherwise, use the full value of the first item in the "question" array.

2. **If the question is missing or incomprehensible**, return:
\`\`\`json
{
  "result": "Pass",
  "comment": "pass"
}
\`\`\`

3. **Strictly reject answers that match the following patterns**, regardless of content:
   - Student responses that indicate avoidance or prior completion, such as:
     - "เคยทำแล้ว", "ทำไปแล้ว", "ตอบไปแล้ว", "แอบถามคำตอบ", or similar phrases in any language (e.g., "I already did it", "I asked for the answer")
   - These must return:
\`\`\`json
{
  "result": "Fail",
  "comment": "ไม่อนุญาตให้เลี่ยงคำถามหรือแอบถามคำตอบ กรุณาตอบใหม่ด้วยตนเอง"
}
\`\`\`

3.1 **Reject error-like or placeholder answers**, such as:
   - "There was an error generating response", "Something went wrong", "This is not the answer", etc.
   - Any phrase that clearly looks like an error message, loading issue, or unrelated system message.

Return:
\`\`\`json
{
  "result": "Fail",
  "comment": "คำตอบไม่สมบูรณ์หรือไม่เกี่ยวข้อง กรุณาตอบคำถามใหม่ให้ตรงประเด็น"
}
\`\`\`

4. **Otherwise**, evaluate the student's answer as follows:

**Evaluation Rules:**
- Use the \`realAnswer\` field as a reference to determine the intended answer, but do not require an exact match.
- The student's answer is acceptable if it reflects a clear understanding of the core intent of the question, even if phrased differently.
- If the answer is irrelevant, incorrect, or shows misunderstanding, return "Fail" and provide constructive feedback (without giving the correct answer).
- If the answer is reasonable, accurate, or shows partial understanding, return "Pass" with encouraging feedback and suggestions to improve if needed.

**Language:**
- Respond in the same language used in the student's \`answer\`.
- If unclear, default to Thai.

**JSON Compliance:**
- Output must be a valid JSON object with properly escaped characters. Never output malformed JSON.

**Input Format:**
\`\`\`json
{
  "question": [
    { "valueType": "text", "value": "Quest! : ยกตัวอย่างเกมที่สร้างด้วย Unity" }
  ],
  "answer": "Pokémon Go ถูกสร้างจาก Unity",
  "realAnswer": "Pokémon Go"
}
\`\`\`
or
\`\`\`json
{
  "question": [
    { "valueType": "text", "value": "14B-1 Mixamo Animation
ทำ Animation เองมันนาน แถมต้องเรียนอีกยาว แต่!!! เรามีทางลัด ลองใช้ Mixamo ทำ Animation สิ

<b>Quest! :</b> ว่าไปนั่น..เราส่งอะไรก็ได้ที่สอนใช้ Mixamo ทำ Animation หน่อยสิ พอดีพี่ทำไม่เป็นอะ" }
  ],
  "answer": "เพิ่ม model ที่เราสร้าง > เลือก rig กระดูก > เลือก animation > export ไปใช้งานใน"
}
\`\`\`

**Output Format:**
\`\`\`json
{
  "result": "Pass",
  "comment": "เยี่ยมมาก เข้าใจคำถามและตอบได้ตรงประเด็น"
}
\`\`\`
`;

const createPayload = (message) => {
  return {
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: aiAssistantPrompt
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(message)
          }
        ]
      }
    ],
    text: {
      format: {
        type: "text"
      }
    },
    reasoning: {},
    model: "gpt-4.1-nano",
    tools: [],
    temperature: 0.85,
    max_output_tokens: 350,
    top_p: 0.8,
    store: true
  };
};

const headers = {
  Authorization: `Bearer ${OPEN_AI_AUTHORIZATION}`,
  "OpenAI-Organization": OPEN_AI_ORGANIZATION,
  "OpenAI-Project": OPEN_AI_PROJECT,
  "Content-Type": "application/json"
};

class OpenAIService {
  /**
   * ให้รางวัลกับผู้ใช้
   * @param {string|object} question - ไอดีของผู้ใช้
   * @param {string} answer - ไอดีของรางวัล
   * @return {string} - คำตอบจาก AI
   * @throws {OpenAIException} - หาก token หมด หรือ ข้อมูลไม่ถูกต้อง
   */
  static async checkAnswer(question, answer) {
    const payload = createPayload(JSON.stringify({
      question,
      answer
    }));

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new OpenAIException(`HTTP error! ${response.status}: ${errorDetails}`);
    }

    const responseJson = await response.json();

    const outputs = responseJson.output;

    let contentText = undefined;

    for (const output of outputs) {
      if (output.type === "message") {
        for (const content of output.content) {
          if (content.type === "output_text") {
            // แปลง string JSON จาก AI เป็น object
            contentText = JSON.parse(content.text);
          }
        }
      }
    }

    if (contentText) {
      if (contentText.result?.toLowerCase() === "fail") {
        throw new OpenAIException(contentText.comment);
      } else {
        return contentText.comment;
      }
    }

    return null;
  }

  /**
   * ให้รางวัลกับผู้ใช้
   * @param {string|object} question - ไอดีของผู้ใช้
   * @param {string|object} realAnswer - ไอดีของผู้ใช้
   * @param {string} answer - ไอดีของรางวัล
   * @return {string} - คำตอบจาก AI
   * @throws {OpenAIException} - หาก token หมด หรือ ข้อมูลไม่ถูกต้อง
   */
  static async checkAnswerWithRealAnswer(question, realAnswer, answer) {
    const payload = createPayload(JSON.stringify({
      question,
      realAnswer,
      answer
    }));

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new OpenAIException(`HTTP error! ${response.status}: ${errorDetails}`);
    }

    const responseJson = await response.json();

    const outputs = responseJson.output;

    let contentText = undefined;

    for (const output of outputs) {
      if (output.type === "message") {
        for (const content of output.content) {
          if (content.type === "output_text") {
            // แปลง string JSON จาก AI เป็น object
            contentText = JSON.parse(content.text);
          }
        }
      }
    }

    if (contentText) {
      if (contentText.result?.toLowerCase() === "fail") {
        throw new OpenAIException(contentText.comment);
      } else {
        return contentText.comment;
      }
    }

    return null;
  }
}

class OpenAIException extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "OpenAIException";
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export { OpenAIService, OpenAIException };
