const fs = require('fs');
const path = require('path');

const inputFolder = './input';
const outputFolder = './output';

if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
}

const systemPrompt = `Bạn là một biên tập viên webnovel tiếng Việt kỳ cựu. Nhiệm vụ của bạn là nhận vào đoạn văn bản dịch thô/Convert và viết lại thành văn phong thuần Việt mượt mà, hấp dẫn như một tác giả Việt Nam tự sáng tác.
Quy tắc:
1. Sửa cấu trúc câu Hán Việt cứng nhắc thành tiếng Việt tự nhiên.
2. Giữ nguyên thuật ngữ chuyên dụng thể loại (Linh khí, Trúc cơ, Thái dương...).
3. Tuyệt đối không tóm tắt hay bỏ sót tình tiết.`;

// Hàm tạm dừng (sleep)
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function callGeminiApi(model, apiKey, promptText, maxRetries = 3) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: promptText }]
                        }
                    ]
                })
            });

            const data = await response.json();

            if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
                return data.candidates[0].content.parts[0].text;
            }

            // Nếu gặp lỗi quá tải (503 / High demand), chờ 3 giây rồi thử lại
            if (data.error && (data.error.code === 503 || data.error.status === 'UNAVAILABLE')) {
                console.warn(`Model ${model} đang bận (Lần thử ${attempt}/${maxRetries}). Đợi 3s thử lại...`);
                await delay(3000);
                continue;
            }

            console.warn(`Model ${model} phản hồi không hợp lệ:`, JSON.stringify(data));
            break; // Lỗi khác (404, invalid key...) thì chuyển sang model tiếp theo ngay
        } catch (err) {
            console.warn(`Lỗi kết nối tới ${model} (Lần ${attempt}):`, err.message);
            await delay(2000);
        }
    }
    return null;
}

async function processFiles() {
    if (!fs.existsSync(inputFolder)) {
        console.log("Thư mục input chưa tồn tại.");
        return;
    }

    const files = fs.readdirSync(inputFolder);
    const apiKey = process.env.AI_API_KEY;

    if (!apiKey) {
        console.error("Lỗi: Không tìm thấy AI_API_KEY trong Environment Secrets!");
        process.exit(1);
    }

    // Ưu tiên các model theo thứ tự
    const models = ['gemini-3.8-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-pro'];

    for (const file of files) {
        if (!file.endsWith('.txt')) continue;

        const inputPath = path.join(inputFolder, file);
        const outputPath = path.join(outputFolder, file);

        console.log(`Đang xử lý file: ${file}...`);
        const content = fs.readFileSync(inputPath, 'utf8');
        const promptText = systemPrompt + "\n\nĐoạn văn bản Convert cần biên tập:\n\n" + content;

        let resultText = null;
        let usedModel = '';

        for (const model of models) {
            resultText = await callGeminiApi(model, apiKey, promptText);
            if (resultText) {
                usedModel = model;
                break;
            }
        }

        if (resultText) {
            fs.writeFileSync(outputPath, resultText, 'utf8');
            console.log(`Đã hoàn thành file: ${file} (Sử dụng model ${usedModel})`);
        } else {
            console.error(`Không thể xử lý file ${file} do tất cả model đều quá tải hoặc lỗi.`);
            process.exit(1);
        }
    }
}

processFiles();
