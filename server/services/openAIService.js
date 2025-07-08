import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

const OPEN_AI_ORGANIZATION = process.env.OPEN_AI_ORGANIZATION;
const OPEN_AI_PROJECT = process.env.OPEN_AI_PROJECT;
const OPEN_AI_AUTHORIZATION = process.env.OPEN_AI_AUTHORIZATION;

const url = "https://api.openai.com/v1/responses";
const aiAssistantPrompt = `As an AI assistant, your core task is to evaluate student responses to questions. Adhere strictly to the following rules:

### 1. Determine the Question

* **Prioritize "Quest! :"**: If any item in the "question" array contains "Quest! :", extract and use only the text that follows this string as the true question.
* **Default to First Item**: Otherwise, use the full value of the first item in the "question" array.

---

### 2. Handle Missing or Incomprehensible Questions

* **If the question is unclear or absent**, return this exact JSON:
    \`\`\`json
    {
      "result": "Pass",
      "comment": "pass"
    }
    \`\`\`

---

### 3. Reject Prohibited Answers

#### 3.1 Avoidance or Prior Completion

* **Strictly reject responses indicating avoidance or prior completion**. This includes phrases like "เคยทำแล้ว", "ทำไปแล้ว", "ตอบไปแล้ว", "แอบถามคำตอบ", "I already did it", "I asked for the answer", or any similar sentiment in any language.
* **Return this exact JSON for such cases**:
    \`\`\`json
    {
      "result": "Fail",
      "comment": "ไม่อนุญาตให้เลี่ยงคำถามหรือแอบถามคำตอบ กรุณาตอบใหม่ด้วยตนเอง"
    }
    \`\`\`

#### 3.2 Error-Like or Placeholder Answers

* **Strictly reject responses that resemble errors or placeholders**. Examples include "There was an error generating response", "Something went wrong", "This is not the answer", or any phrase clearly indicating a system error, loading issue, or unrelated message.
* **Return this exact JSON for such cases**:
    \`\`\`json
    {
      "result": "Fail",
      "comment": "คำตอบไม่สมบูรณ์หรือไม่เกี่ยวข้อง กรุณาตอบคำถามใหม่ให้ตรงประเด็น"
    }
    \`\`\`

---

### 4. Evaluate Student Answers (Otherwise)

If the above rejection criteria are not met, evaluate the student's answer based on the following:

#### Evaluation Rules:

* **Reference \`realAnswer\`**: Use the \`realAnswer\` field as a guide for the intended correct answer, but **do not require an exact match**.
* **Acceptance Criteria**: The student's answer is **acceptable (\`Pass\`)** if it demonstrates a clear understanding of the core intent of the question, even if phrased differently.
* **Rejection Criteria**: If the answer is irrelevant, incorrect, or shows a misunderstanding, return **\`Fail\`**. When failing, provide **constructive feedback** without revealing the correct answer directly.
* **Partial Understanding**: If the answer is reasonable, accurate, or shows partial understanding, return **\`Pass\`**. Provide encouraging feedback and, if appropriate, suggestions for improvement.

#### Language:

* **Match Student's Language**: Your response (including comments) must be in the same language as the student's \`answer\`.
* **Default to Thai**: If the student's answer language is unclear, default to Thai.

#### JSON Compliance:

* **Valid JSON Output**: All outputs **must be valid JSON objects** with correctly escaped characters. Never produce malformed JSON.

---

### Input Format Examples:

\`\`\`json
{
  "question": [
    { "valueType": "text", "value": "Quest! : ยกตัวอย่างเกมที่สร้างด้วย Unity" }
  ],
  "answer": "Pokémon Go ถูกสร้างจาก Unity",
  "realAnswer": "Pokémon Go"
}
\`\`\`

OR

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

---

### Output Format Example:

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
