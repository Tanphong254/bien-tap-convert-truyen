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

    for (const file of files) {
        if (!file.endsWith('.txt')) continue;
        
        const inputPath = path.join(inputFolder, file);
        const outputPath = path.join(outputFolder, file);
        
        console.log(`Đang xử lý file: ${file}...`);
        const content = fs.readFileSync(inputPath, 'utf8');

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                { text: systemPrompt + "\n\nĐoạn văn bản Convert cần biên tập:\n\n" + content }
                            ]
                        }
                    ]
                })
            });

            const data = await response.json();
            if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
                const resultText = data.candidates[0].content.parts[0].text;
                fs.writeFileSync(outputPath, resultText, 'utf8');
                console.log(`Đã hoàn thành file: ${file}`);
            } else {
                console.error(`Lỗi từ Gemini API cho file ${file}:`, JSON.stringify(data));
                process.exit(1);
            }
        } catch (err) {
            console.error(`Lỗi kết nối cho file ${file}:`, err);
            process.exit(1);
        }
    }
}

processFiles();
