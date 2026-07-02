import fs from "fs";

async function run() {
    const apiKey = "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";
    const res = await fetch("https://integrate.api.nvidia.com/v1/models", {
        headers: { "Authorization": `Bearer ${apiKey}` }
    });
    const data = await res.json();
    const models = data.data.map(m => m.id);
    const nemotronModels = models.filter(m => m.includes("nemotron"));
    console.log(nemotronModels);
}
run();
