import fs from "fs";

async function checkEndpoint(url) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Authorization": "Bearer BAD_KEY" }
    });
    console.log(url, res.status, await res.text());
}

async function run() {
    await checkEndpoint("https://ai.api.nvidia.com/v1/cv/nvidia/nemotron-ocr-v2/infer");
    await checkEndpoint("https://ai.api.nvidia.com/v1/vlm/nvidia/nemotron-ocr-v2/infer");
    await checkEndpoint("https://ai.api.nvidia.com/v1/vlm/nvidia/nemotron-ocr-v2/chat/completions");
    await checkEndpoint("https://ai.api.nvidia.com/v1/retrieval/nvidia/nemotron-ocr-v2/infer");
    await checkEndpoint("https://integrate.api.nvidia.com/v1/chat/completions");
}
run();
